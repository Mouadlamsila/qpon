import { readFileSync } from 'node:fs'
import pg from 'pg'

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
)
const ref = new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0]
const c = new pg.Client({
  host: 'aws-0-eu-north-1.pooler.supabase.com', port: 6543,
  user: 'postgres.' + ref, password: env.VITE_SUPABASE_DB_PASSWORD,
  database: 'postgres', ssl: { rejectUnauthorized: false },
})
await c.connect()
const q = async (label, sql, params = []) => {
  const r = await c.query(sql, params)
  console.log(`\n## ${label}`)
  console.log(JSON.stringify(r.rows, null, 2))
}
await q('orgs', `select id,name,created_at from public.organizations order by name`)
await q('profiles', `select p.id,p.email,p.role,p.organization_id,o.name org from public.profiles p left join public.organizations o on o.id=p.organization_id order by p.email`)
await q('auth users', `select id,email,created_at from auth.users order by email`)
await q('zones', `select z.id,z.restaurant_id,o.name org,z.name,z.code,z.flyers_distributed, (select count(*) from public.orders oo where oo.zone_id=z.id) orders from public.zones z join public.organizations o on o.id=z.restaurant_id order by o.name,z.name`)
await q('promos', `select p.id,o.name org,p.name,p.price_place,p.price_delivery,p.active,(select count(*) from public.orders oo where oo.promo_id=p.id) orders from public.promos p join public.organizations o on o.id=p.restaurant_id order by o.name,p.name`)
await q('campaigns', `select c.id,o.name org,c.name,c.cost,c.start_date,c.end_date,c.created_at from public.campaigns c join public.organizations o on o.id=c.restaurant_id order by c.start_date,c.created_at`)
await q('order range', `select count(*), min(created_at) min, max(created_at) max, min(created_at)::date mindate from public.orders`)
await q('orders by org', `select o.name,count(*) n,min(oo.created_at) min,max(oo.created_at) max from public.orders oo join public.organizations o on o.id=oo.restaurant_id group by o.name`)
await q('orders by zone', `select z.name,count(*) n,min(o.created_at) min,max(o.created_at) max from public.orders o join public.zones z on z.id=o.zone_id group by z.name`)
await q('orders test-zone', `select o.* from public.orders o join public.zones z on z.id=o.zone_id where z.code='test' or z.name ilike '%test%'`)
await q('constraints campaigns', `select conname,pg_get_constraintdef(oid) def from pg_constraint where conrelid='public.campaigns'::regclass`)
await q('tables', `select table_name from information_schema.tables where table_schema='public' order by table_name`)
await c.end()
