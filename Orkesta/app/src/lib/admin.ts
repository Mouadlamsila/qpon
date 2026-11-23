import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Channel, Period } from './types'
import { previousRange, periodStart } from './period'

// Admin data layer — requêtes Supabase. RLS s'applique côté serveur :
// admin_foued voit tout (bypass), server_restaurant voit son tenant.
// Sans auth → [] (sécurisé, vérifié).

export interface ZoneStat {
  id: string
  name: string
  code: string
  color: string
  flyersDistributed: number
  used: number
  ca: number
  taux: number
}

export interface CostRow {
  id: string
  date: string
  cost: number
}

export interface PromoStat {
  id: string
  name: string
  pricePlace: number
  priceDelivery: number
  active: boolean
  used: number
  ca: number
}

export interface OrgStat {
  id: string
  name: string
  zones: number
  orders: number
  ca: number
  panierMoyen: number
  cost: number
  roi: number | null
}

export interface OrderRow {
  id: string
  channel: Channel
  amount: number
  createdAt: string
  zoneName: string
  zoneColor: string
  promoName: string
  orgName: string
}

export interface Dashboard {
  orgId: string | null
  orgName: string
  orgs: { id: string; name: string }[]
  distribues: number
  utilises: number
  taux: number
  caTotal: number
  caSurPlace: number
  caLivraison: number
  caUber: number
  caTakeaway: number
  caAppli: number
  panierMoyen: number
  cost: number
  costPerOrder: number
  roi: number | null
  prev: { caTotal: number; utilises: number } | null
  byZone: ZoneStat[]
  byPromo: PromoStat[]
  byOrg: OrgStat[]
  recent: OrderRow[]
}

// Sign in Foued (admin). Lance error si mal credentiel.
export async function signIn(email: string, password: string) {
  if (!supabase) throw new Error('Supabase non configuré')
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function signOut() {
  if (supabase) await supabase.auth.signOut()
}

export async function isAdmin(): Promise<boolean> {
  if (!supabase) return false
  const { data } = await supabase.auth.getUser()
  if (!data.user) return false
  const { data: prof } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single()
  return prof?.role === 'admin_foued'
}

// Lien "Admin" dans le header : seulement si le compte connecté est admin.
// UX uniquement — /admin reste protégé par PIN + login + rôle.
export function useIsAdmin(): boolean {
  const [admin, setAdmin] = useState(false)
  useEffect(() => {
    if (!supabase) return
    let alive = true
    const check = async () => {
      const { data: sess } = await supabase!.auth.getSession() // local (offline OK)
      if (!alive) return
      if (!sess.session) { setAdmin(false); return }
      const { data: prof, error } = await supabase!
        .from('profiles')
        .select('role')
        .eq('id', sess.session.user.id)
        .single()
      if (!alive) return
      // Erreur réseau → garde l'état précédent. Sinon rôle = vérité.
      if (!error) setAdmin(prof?.role === 'admin_foued')
    }
    void check()
    const { data } = supabase.auth.onAuthStateChange(() => void check())
    return () => { alive = false; data.subscription.unsubscribe() }
  }, [])
  return admin
}

// Charge le dashboard : filtre restaurant + période (BRIEF §5.2).
// orgId = null → "Tous clients" (admin seulement via RLS).
export async function loadDashboard(period: Period = 'all', orgId: string | null = null): Promise<Dashboard> {
  if (!supabase) throw new Error('Supabase non configuré')

  const start = periodStart(period)
  const prev = previousRange(period)

  let ordersQ = supabase
    .from('orders')
    .select('id, channel, amount, created_at, restaurant_id, zone_id, promo_id')
    .order('created_at', { ascending: false })
  // shortcut: PostgREST plafonne à 1000 lignes ; paginer si volume supérieur.
  if (orgId) ordersQ = ordersQ.eq('restaurant_id', orgId)
  if (start) ordersQ = ordersQ.gte('created_at', start.toISOString())

  let zonesQ = supabase
    .from('zones')
    .select('id, restaurant_id, name, code, color, flyers_distributed')
  if (orgId) zonesQ = zonesQ.eq('restaurant_id', orgId)

  let promosQ = supabase
    .from('promos')
    .select('id, restaurant_id, name, price_place, price_delivery, active')
  if (orgId) promosQ = promosQ.eq('restaurant_id', orgId)

  let campQ = supabase.from('campaigns').select('cost, start_date, restaurant_id')
  if (orgId) campQ = campQ.eq('restaurant_id', orgId)
  if (start) campQ = campQ.gte('start_date', start.toISOString().slice(0, 10))

  let prevQ = null
  if (prev) {
    prevQ = supabase
      .from('orders')
      .select('amount')
      .gte('created_at', prev.start.toISOString())
      .lt('created_at', prev.end.toISOString())
    if (orgId) prevQ = prevQ.eq('restaurant_id', orgId)
  }

  const [orgsRes, zonesRes, promosRes, ordersRes, campRes, prevRes] = await Promise.all([
    supabase.from('organizations').select('id, name').order('name'),
    zonesQ,
    promosQ,
    ordersQ,
    campQ,
    prevQ ?? Promise.resolve({ data: null, error: null }),
  ])

  const anyErr = orgsRes.error ?? zonesRes.error ?? promosRes.error ?? ordersRes.error ?? campRes.error ?? prevRes?.error
  if (anyErr) throw anyErr

  const orgs = (orgsRes.data ?? []) as { id: string; name: string }[]
  const z = (zonesRes.data ?? []) as {
    id: string; restaurant_id: string; name: string; code: string; color: string; flyers_distributed: number
  }[]
  const p = (promosRes.data ?? []) as {
    id: string; restaurant_id: string; name: string; price_place: number; price_delivery: number; active: boolean
  }[]
  const o = (ordersRes.data ?? []) as {
    id: string; channel: Channel; amount: number; created_at: string
    restaurant_id: string; zone_id: string; promo_id: string
  }[]
  const campRows = (campRes.data ?? []) as { cost: number; restaurant_id: string }[]
  const cost = campRows.reduce((s, c) => s + Number(c.cost), 0)
  const prevRows = (prevRes?.data ?? []) as { amount: number }[]

  const orgName = orgId ? (orgs.find((x) => x.id === orgId)?.name ?? '—') : 'Tous clients'
  const distribues = z.reduce((s, x) => s + (x.flyers_distributed ?? 0), 0)
  const utilises = o.length
  const caTotal = o.reduce((s, x) => s + Number(x.amount), 0)
  const sumCh = (ch: Channel) => o.filter((x) => x.channel === ch).reduce((s, x) => s + Number(x.amount), 0)

  const byZone: ZoneStat[] = z.map((zz) => {
    const zo = o.filter((x) => x.zone_id === zz.id)
    const used = zo.length
    const flyers = zz.flyers_distributed ?? 0
    return {
      id: zz.id,
      name: zz.name,
      code: zz.code,
      color: zz.color,
      flyersDistributed: flyers,
      used,
      ca: zo.reduce((s, x) => s + Number(x.amount), 0),
      taux: flyers > 0 ? (used / flyers) * 100 : 0,
    }
  }).sort((a, b) => b.ca - a.ca)

  const byPromo: PromoStat[] = p.map((pp) => {
    const po = o.filter((x) => x.promo_id === pp.id)
    return {
      id: pp.id,
      name: pp.name,
      pricePlace: Number(pp.price_place),
      priceDelivery: Number(pp.price_delivery),
      active: pp.active,
      used: po.length,
      ca: po.reduce((s, x) => s + Number(x.amount), 0),
    }
  }).sort((a, b) => b.ca - a.ca)

  const byOrg: OrgStat[] = orgs.map((org) => {
    const zo = z.filter((x) => x.restaurant_id === org.id)
    const oo = o.filter((x) => x.restaurant_id === org.id)
    const ca = oo.reduce((s, x) => s + Number(x.amount), 0)
    const co = campRows.filter((c) => c.restaurant_id === org.id).reduce((s, c) => s + Number(c.cost), 0)
    return {
      id: org.id,
      name: org.name,
      zones: zo.length,
      orders: oo.length,
      ca,
      panierMoyen: oo.length > 0 ? ca / oo.length : 0,
      cost: co,
      roi: co > 0 ? ((ca - co) / co) * 100 : null,
    }
  }).sort((a, b) => (b.roi ?? -1e9) - (a.roi ?? -1e9) || b.ca - a.ca)

  const orgById = new Map(orgs.map((x) => [x.id, x.name]))
  const zoneById = new Map(z.map((x) => [x.id, x]))
  const promoById = new Map(p.map((x) => [x.id, x]))

  const recent: OrderRow[] = o.slice(0, 10).map((x) => ({
    id: x.id,
    channel: x.channel,
    amount: Number(x.amount),
    createdAt: x.created_at,
    zoneName: zoneById.get(x.zone_id)?.name ?? '—',
    zoneColor: zoneById.get(x.zone_id)?.color ?? '#999',
    promoName: promoById.get(x.promo_id)?.name ?? '—',
    orgName: orgById.get(x.restaurant_id) ?? '—',
  }))

  return {
    orgId,
    orgName,
    orgs,
    distribues,
    utilises,
    taux: distribues > 0 ? (utilises / distribues) * 100 : 0,
    caTotal,
    caSurPlace: sumCh('SUR_PLACE'),
    caLivraison: sumCh('LIVRAISON'),
    caUber: sumCh('UBER'),
    caTakeaway: sumCh('TAKEAWAY'),
    caAppli: sumCh('APPLI'),
    panierMoyen: utilises > 0 ? caTotal / utilises : 0,
    cost,
    costPerOrder: utilises > 0 ? cost / utilises : 0,
    roi: cost > 0 ? ((caTotal - cost) / cost) * 100 : null,
    prev: prev ? {
      caTotal: prevRows.reduce((s, x) => s + Number(x.amount), 0),
      utilises: prevRows.length,
    } : null,
    byZone,
    byPromo,
    byOrg,
    recent,
  }
}

// Coût de campagne (BRIEF §6 : ROI + coût/commande).
export async function addCampaignCost(orgId: string, cost: number): Promise<void> {
  if (!supabase) throw new Error('Supabase non configuré')
  const { error } = await supabase.from('campaigns').insert({
    restaurant_id: orgId,
    name: 'Campagne',
    cost,
    start_date: new Date().toISOString().slice(0, 10),
  })
  if (error) throw error
}

// Activer/désactiver une promo (suppression bloquée si des commandes la référencent).
export async function setPromoActive(id: string, active: boolean): Promise<void> {
  if (!supabase) throw new Error('Supabase non configuré')
  const { error } = await supabase.from('promos').update({ active }).eq('id', id)
  if (error) throw error
}

// Mise à jour des flyers distribués (base du taux d'attribution).
export async function setZoneFlyers(id: string, flyers: number): Promise<void> {
  if (!supabase) throw new Error('Supabase non configuré')
  if (!Number.isFinite(flyers)) return
  const n = Math.max(0, Math.trunc(flyers))
  const { error } = await supabase.from('zones').update({ flyers_distributed: n }).eq('id', id)
  if (error) throw error
}

// Onboarding restaurant via RPC SQL admin-only (migration 0003).
// Pas d'Edge Function à déployer : la fonction vérifie is_admin() et crée
// org + auth user (bcrypt) + identity + profile.
export async function addRestaurant(name: string, email: string, password: string): Promise<void> {
  if (!supabase) throw new Error('Supabase non configuré')
  const { error } = await supabase.rpc('admin_create_restaurant', {
    p_name: name,
    p_email: email,
    p_password: password,
  })
  if (error) {
    if (/could not find the function|does not exist/i.test(error.message)) {
      throw new Error('RPC admin_create_restaurant absente — applique la migration 0003.')
    }
    throw new Error(error.message)
  }
}
