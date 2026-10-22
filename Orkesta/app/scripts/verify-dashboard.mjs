// Vérifie les requêtes du dashboard (filtre restaurant, embed CSV, campagne, prev).
// Usage : node scripts/verify-dashboard.mjs (exit 1 si erreur)
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()])
)
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
const { error: authErr } = await sb.auth.signInWithPassword({
  email: 'foued@orkesta.com', password: env.ADMIN_PASSWORD,
})
if (authErr) throw authErr

const orgs = await sb.from('organizations').select('id, name').order('name')
if (orgs.error) throw orgs.error
console.log('orgs:', orgs.data.length, orgs.data.map((o) => o.name).join(', '))

const orgId = orgs.data[0]?.id
const zones = await sb.from('zones').select('id, restaurant_id, name, code, color, flyers_distributed').eq('restaurant_id', orgId)
const promos = await sb.from('promos').select('id, restaurant_id, name, price_place, price_delivery, active').eq('restaurant_id', orgId)
const orders = await sb.from('orders')
  .select('id, channel, amount, created_at, restaurant_id, zone_id, promo_id')
  .eq('restaurant_id', orgId)
  .order('created_at', { ascending: false })
if (zones.error || promos.error || orders.error) throw zones.error ?? promos.error ?? orders.error
console.log('zones:', zones.data.length, '| promos:', promos.data.length, '| orders:', orders.data.length)

const camps = await sb.from('campaigns').select('cost, start_date').eq('restaurant_id', orgId)
if (camps.error) throw camps.error
console.log('campaigns:', camps.data.length, '| cost:', camps.data.reduce((s, c) => s + Number(c.cost), 0))

// Embed utilisé par l'export CSV (FK organizations).
const csv = await sb.from('orders')
  .select('created_at, amount, channel, client_last4, zones(name), promos(name), organizations(name)')
  .order('created_at', { ascending: false }).limit(2)
if (csv.error) throw csv.error
console.log('csv embed OK:', JSON.stringify(csv.data[0] ?? null))

// Fenêtre précédente (comparaison).
const d = new Date()
d.setHours(0, 0, 0, 0)
const start = new Date(d); start.setDate(start.getDate() - 7)
const prev = await sb.from('orders').select('amount')
  .eq('restaurant_id', orgId)
  .gte('created_at', start.toISOString())
  .lt('created_at', d.toISOString())
if (prev.error) throw prev.error
console.log('prev week orders:', prev.data.length)

console.log('\n✅ dashboard queries OK')
