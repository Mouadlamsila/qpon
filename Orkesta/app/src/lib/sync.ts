import { useLiveQuery } from 'dexie-react-hooks'
import { db, type PendingOrder } from './db'
import { supabase } from './supabase'

// P2 — Sync offline-first. Server = source of truth.
// Push : Dexie pendingOrders → Supabase (client_uuid = idempotency, upsert on PK).
// Pull : Supabase orgs/zones/promos → Dexie (remplace, server wins).
// Ordre important : PUSH d'abord (drain queue), puis PULL (référence fraîche).

// Journal de sync lisible dans l'UI (dev) — évite de deviner pourquoi ça bloque.
export const syncLog: string[] = []
function log(msg: string) {
  syncLog.push(`${new Date().toTimeString().slice(0, 8)} ${msg}`)
  if (syncLog.length > 40) syncLog.shift()
  console.log('[sync]', msg)
}

export async function hasSession(): Promise<boolean> {
  if (!supabase) return false
  const { data } = await supabase.auth.getUser()
  return Boolean(data.user)
}

// Push les zones/promos créés offline. Server = source of truth → on ne pousse
// QUE les rows absentes du serveur (jamais écraser une modif serveur).
// Filtre restaurant_id : le seed local (UUID factice) ne doit pas partir en FK.
export async function pushReference(): Promise<void> {
  if (!supabase) return
  const [{ data: orgs }, { data: serverZones }, { data: serverPromos }] = await Promise.all([
    supabase.from('organizations').select('id'),
    supabase.from('zones').select('id'),
    supabase.from('promos').select('id'),
  ])
  const knownOrg = new Set((orgs ?? []).map((o) => o.id))
  const knownZone = new Set((serverZones ?? []).map((z) => z.id))
  const knownPromo = new Set((serverPromos ?? []).map((p) => p.id))
  if (knownOrg.size === 0) return

  const [zones, promos] = await Promise.all([db.zones.toArray(), db.promos.toArray()])

  const newZones = zones.filter((z) => knownOrg.has(z.restaurantId) && !knownZone.has(z.id))
  if (newZones.length > 0) {
    const { error } = await supabase.from('zones').upsert(newZones.map((z) => ({
      id: z.id, restaurant_id: z.restaurantId, name: z.name, code: z.code, color: z.color, flyers_distributed: z.flyersDistributed,
    })), { onConflict: 'id', ignoreDuplicates: true }) // INSERT only (RLS : pas d'UPDATE restaurant)
    if (error) console.error('[sync] push zones failed:', error.message)
  }

  const newPromos = promos.filter((p) => knownOrg.has(p.restaurantId) && !knownPromo.has(p.id))
  if (newPromos.length > 0) {
    const { error } = await supabase.from('promos').upsert(newPromos.map((p) => ({
      id: p.id, restaurant_id: p.restaurantId, name: p.name, price_place: p.pricePlace, price_delivery: p.priceDelivery, active: p.active,
    })), { onConflict: 'id', ignoreDuplicates: true })
    if (error) console.error('[sync] push promos failed:', error.message)
  }
}

// Push les commandes en attente. Idempotent : upsert sur id (client_uuid).
// Row par row : une commande invalide (FK) ne bloque plus tout le lot.
export async function pushOrders(): Promise<number> {
  if (!supabase) return 0
  const pending = await db.pendingOrders.where('status').equals('pending').toArray()
  if (pending.length === 0) return 0

  let pushed = 0
  for (const o of pending) {
    const { error } = await supabase.from('orders').upsert({
      id: o.id, // client_uuid = PK idempotent
      restaurant_id: o.restaurantId,
      zone_id: o.zoneId,
      promo_id: o.promoId,
      channel: o.channel,
      amount: o.amount,
      client_last4: o.clientLast4 ?? null,
      created_at: new Date(o.createdAt).toISOString(),
    }, { onConflict: 'id', ignoreDuplicates: true }) // rejeu = no-op (RLS : pas d'UPDATE restaurant)

    if (error) {
      // Marque en error pour ne pas boucler. Les autres commandes continuent.
      log(`push FAIL ${o.id.slice(0, 8)}: ${error.message}`)
      await db.pendingOrders.update(o.id, { status: 'error', lastError: error.message })
    } else {
      // Queue = file d'attente, pas un historique.
      await db.pendingOrders.delete(o.id)
      pushed++
    }
  }
  return pushed
}

// Pull référence (orgs/zones/promos) → Dexie. Remplace (server wins).
// Ne touche PAS pendingOrders.
export async function pullReference(): Promise<void> {
  if (!supabase) return
  const [orgs, zones, promos] = await Promise.all([
    supabase.from('organizations').select('id, name, created_at'),
    supabase.from('zones').select('id, restaurant_id, name, code, color, flyers_distributed'),
    supabase.from('promos').select('id, restaurant_id, name, price_place, price_delivery, active'),
  ])
  if (orgs.error || zones.error || promos.error) {
    log(`pull FAIL: ${(orgs.error ?? zones.error ?? promos.error)?.message}`)
    return
  }

  await db.transaction('rw', db.orgs, db.zones, db.promos, async () => {
    await db.orgs.clear()
    await db.zones.clear()
    await db.promos.clear()
    await db.orgs.bulkPut((orgs.data ?? []).map((o) => ({ id: o.id, name: o.name, createdAt: Date.parse(o.created_at) })))
    await db.zones.bulkPut((zones.data ?? []).map((z) => ({
      id: z.id, restaurantId: z.restaurant_id, name: z.name, code: z.code, color: z.color, flyersDistributed: z.flyers_distributed,
    })))
    await db.promos.bulkPut((promos.data ?? []).map((p) => ({
      id: p.id, restaurantId: p.restaurant_id, name: p.name, pricePlace: Number(p.price_place), priceDelivery: Number(p.price_delivery), active: p.active,
    })))
  })

  // Historique local : dernières commandes serveur (survit à la sync).
  const { data: hist, error: histErr } = await supabase
    .from('orders')
    .select('id, restaurant_id, zone_id, promo_id, channel, amount, client_last4, created_at')
    .order('created_at', { ascending: false })
    .limit(50)
  if (histErr) log(`pull history FAIL: ${histErr.message}`)
  if (hist) {
    await db.orders.bulkPut(hist.map((o) => ({
      id: o.id,
      restaurantId: o.restaurant_id,
      zoneId: o.zone_id,
      promoId: o.promo_id,
      channel: o.channel,
      amount: Number(o.amount),
      clientLast4: o.client_last4,
      createdAt: Date.parse(o.created_at),
    })))
    const all = await db.orders.orderBy('createdAt').reverse().toArray()
    if (all.length > 200) await db.orders.bulkDelete(all.slice(200).map((x) => x.id))
  }
}

// Un cycle complet : push puis pull. Silencieux (offline = skip, jamais d'erreur bloquante).
export async function runSync(): Promise<void> {
  if (!supabase) return log('skip: supabase null')
  if (!navigator.onLine) return log('skip: offline')
  if (!(await hasSession())) return log('skip: PAS DE SESSION (login admin requis)')
  try {
    await pushReference() // zones/promos créés offline avant leurs commandes (FK)
    const pushed = await pushOrders()
    await pullReference()
    log(`cycle OK — pushed=${pushed}`)
  } catch (e) {
    log(`cycle FAIL: ${(e as Error).message}`)
  }
}

// Nb de commandes en attente de sync (pour badge ⏳ offline).
export function usePendingCount(): number {
  return useLiveQuery(() => db.pendingOrders.where('status').equals('pending').count(), [], 0) ?? 0
}

// Nb de commandes en échec définitif (FK/RLS) — doit être visible, jamais silencieux.
export function useErrorCount(): number {
  return useLiveQuery(() => db.pendingOrders.where('status').equals('error').count(), [], 0) ?? 0
}

// Liste des erreurs (avec la raison) pour le bandeau caisse.
export function useErrors(): PendingOrder[] {
  return useLiveQuery(() => db.pendingOrders.where('status').equals('error').toArray(), [], []) ?? []
}

// Relance manuelle des commandes en échec (après correction côté serveur).
export async function retryErrors(): Promise<number> {
  const n = await db.pendingOrders.where('status').equals('error').count()
  if (n === 0) return 0
  await db.pendingOrders.where('status').equals('error').modify({ status: 'pending', lastError: undefined })
  await runSync()
  return n
}

// Supprime les commandes définitivement irrécupérables (ex : réf. locale supprimée).
export async function discardErrors(): Promise<number> {
  const n = await db.pendingOrders.where('status').equals('error').count()
  await db.pendingOrders.where('status').equals('error').delete()
  log(`discarded ${n} erreur(s)`)
  return n
}

// Démarre le moteur : interval + online + visibilitychange. Retourne cleanup.
export function startSyncEngine(intervalMs = 15000): () => void {
  const tick = () => void runSync()
  const onOnline = () => tick()
  const onVisible = () => { if (document.visibilityState === 'visible') tick() }

  tick() // cycle initial
  const id = setInterval(tick, intervalMs)
  window.addEventListener('online', onOnline)
  document.addEventListener('visibilitychange', onVisible)
  return () => {
    clearInterval(id)
    window.removeEventListener('online', onOnline)
    document.removeEventListener('visibilitychange', onVisible)
  }
}
