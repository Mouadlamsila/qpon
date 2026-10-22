import { supabase } from './supabase'
import { db } from './db'
import { runSync, syncLog } from './sync'
import { isAdmin } from './admin'

// Diagnostic visible dans l'UI (dev). Répond : session ? RLS ? refs FK ? pourquoi sync skip ?
export interface Diag {
  online: boolean
  supabase: boolean
  user: { id: string; email?: string } | null
  session: boolean
  isAdmin: boolean | string
  tables: Record<string, { count: number | null; error: string | null }>
  local: { orgs: number; zones: number; promos: number; pending: number; error: number }
  pendingRows: Array<Record<string, string>>
  syncLog: string[]
}

export async function diagnose(): Promise<Diag> {
  const out: Diag = {
    online: navigator.onLine,
    supabase: Boolean(supabase),
    user: null,
    session: false,
    isAdmin: 'n/a',
    tables: {},
    local: { orgs: 0, zones: 0, promos: 0, pending: 0, error: 0 },
    pendingRows: [],
    syncLog: [...syncLog].slice(-12),
  }

  if (supabase) {
    try {
      const { data, error } = await supabase.auth.getUser()
      out.user = data.user ? { id: data.user.id.slice(0, 8), email: data.user.email } : null
      if (error) out.tables.authError = { count: null, error: error.message }
      const { data: s } = await supabase.auth.getSession()
      out.session = Boolean(s.session)
      out.isAdmin = await isAdmin()
    } catch (e) {
      out.tables.authThrow = { count: null, error: (e as Error).message }
    }

    for (const t of ['profiles', 'organizations', 'zones', 'promos', 'orders']) {
      try {
        const { data, error } = await supabase.from(t).select('id').limit(100)
        out.tables[t] = { count: data?.length ?? null, error: error?.message ?? null }
      } catch (e) {
        out.tables[t] = { count: null, error: (e as Error).message }
      }
    }
  }

  out.local = {
    orgs: await db.orgs.count(),
    zones: await db.zones.count(),
    promos: await db.promos.count(),
    pending: await db.pendingOrders.where('status').equals('pending').count(),
    error: await db.pendingOrders.where('status').equals('error').count(),
  }

  const rows = await db.pendingOrders.limit(4).toArray()
  const zoneIds = new Set((await db.zones.toArray()).map((z) => z.id))
  out.pendingRows = rows.map((r) => ({
    id: r.id.slice(0, 8),
    status: r.status,
    org: r.restaurantId.slice(0, 8),
    zone: `${r.zoneId.slice(0, 8)}${zoneIds.has(r.zoneId) ? '' : ' (ABSENT local)'}`,
    promo: r.promoId.slice(0, 8),
    err: (r.lastError ?? '').slice(0, 80),
  }))

  out.syncLog = [...syncLog].slice(-12)
  return out
}

// Force un cycle immédiat et rapporte le résultat.
export async function forceSync(): Promise<Diag> {
  await runSync()
  return diagnose()
}
