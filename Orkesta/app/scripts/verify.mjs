// Verify: (1) anon REST sees [] (RLS secure), (2) data + stats math via direct.
import { readFileSync } from 'node:fs'
import pg from 'pg'

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split(/\r?\n/).filter((l) => l.includes('='))
    .map((l) => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()] }),
)

// 1. REST as anon → should be [] (RLS blocks, secure)
const res = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/orders?select=*`, {
  headers: { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}` },
})
console.log(`anon REST orders: ${res.status} -> ${await res.text()}  (khass ykoun [] = RLS secure)`)

// 2. Stats via direct
const ref = new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0]
const c = new pg.Client({ host: 'aws-0-eu-north-1.pooler.supabase.com', port: 6543, user: 'postgres.' + ref, password: env.VITE_SUPABASE_DB_PASSWORD, database: 'postgres', ssl: { rejectUnauthorized: false } })
await c.connect()
const stats = await c.query(`
  select count(*) as orders, coalesce(sum(o.amount),0) as ca,
    (select coalesce(sum(flyers_distributed),0) from public.zones) as distribues
  from public.orders o
`)
const byZone = await c.query(`
  select z.name, z.color, z.flyers_distributed, count(o.id) as used, coalesce(sum(o.amount),0) as ca
  from public.zones z left join public.orders o on o.zone_id=z.id
  group by z.id order by ca desc
`)
const s = stats.rows[0]
const taux = Number(s.distribues) > 0 ? (Number(s.orders) / Number(s.distribues) * 100).toFixed(2) : '0'
console.log(`\nSTATS: distribues=${s.distribues} utilises=${s.orders} ca=${s.ca}€ taux=${taux}%`)
console.log('PAR ZONE:')
for (const z of byZone.rows) console.log(`  ${z.name}: used=${z.used} ca=${z.ca}€ flyers=${z.flyers_distributed}`)
await c.end()
