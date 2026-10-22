import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Channel } from './types'

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
}

export interface OrderRow {
  id: string
  channel: Channel
  amount: number
  createdAt: string
  zoneName: string
  zoneColor: string
  promoName: string
}

export interface Dashboard {
  orgName: string
  distribues: number
  utilises: number
  taux: number
  caTotal: number
  caSurPlace: number
  caLivraison: number
  byZone: ZoneStat[]
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

// Charge le dashboard complet (1 zones + 1 orders + 1 org call).
// period='today' → filtre côté serveur (created_at >= début de journée locale).
export async function loadDashboard(period: 'all' | 'today' = 'all'): Promise<Dashboard> {
  if (!supabase) throw new Error('Supabase non configuré')

  let ordersQ = supabase
    .from('orders')
    .select('id, channel, amount, created_at, zone_id, zones(name, color), promos(name)')
    .order('created_at', { ascending: false })
  if (period === 'today') {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    ordersQ = ordersQ.gte('created_at', d.toISOString())
  }

  const [zonesRes, ordersRes, orgRes] = await Promise.all([
    supabase.from('zones').select('id, name, code, color, flyers_distributed'),
    ordersQ,
    supabase.from('organizations').select('name').limit(1),
  ])
  // Ne jamais afficher 0 silencieux : une session expirée / RLS doit être visible.
  if (zonesRes.error) throw zonesRes.error
  if (ordersRes.error) throw ordersRes.error
  if (orgRes.error) throw orgRes.error

  const z = zonesRes.data ?? []
  const o = (ordersRes.data ?? []) as unknown as {
    id: string; channel: Channel; amount: number; created_at: string; zone_id: string
    zones: { name: string; color: string } | null
    promos: { name: string } | null
  }[]

  const distribues = z.reduce((s, x) => s + (x.flyers_distributed ?? 0), 0)
  const utilises = o.length
  const caTotal = o.reduce((s, x) => s + Number(x.amount), 0)
  const caSurPlace = o.filter((x) => x.channel === 'SUR_PLACE').reduce((s, x) => s + Number(x.amount), 0)
  const caLivraison = o.filter((x) => x.channel === 'LIVRAISON').reduce((s, x) => s + Number(x.amount), 0)

  const byZone: ZoneStat[] = z.map((zz) => {
    const zo = o.filter((x) => x.zone_id === zz.id)
    return {
      id: zz.id,
      name: zz.name,
      code: zz.code,
      color: zz.color,
      flyersDistributed: zz.flyers_distributed ?? 0,
      used: zo.length,
      ca: zo.reduce((s, x) => s + Number(x.amount), 0),
    }
  }).sort((a, b) => b.ca - a.ca)

  const recent: OrderRow[] = o.slice(0, 10).map((x) => ({
    id: x.id,
    channel: x.channel,
    amount: Number(x.amount),
    createdAt: x.created_at,
    zoneName: x.zones?.name ?? '—',
    zoneColor: x.zones?.color ?? '#999',
    promoName: x.promos?.name ?? '—',
  }))

  return {
    orgName: orgRes.data?.[0]?.name ?? 'Orkesta',
    distribues,
    utilises,
    taux: distribues > 0 ? (utilises / distribues) * 100 : 0,
    caTotal,
    caSurPlace,
    caLivraison,
    byZone,
    recent,
  }
}
