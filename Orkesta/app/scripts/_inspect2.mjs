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
const q = async (label, sql) => {
  const r = await c.query(sql)
  console.log(`\n## ${label}`)
  console.log(JSON.stringify(r.rows, null, 2))
}
await q('flyer distributions', `select d.id,o.name org,z.name zone,d.count,d.distributed_on from public.flyer_distributions d join public.organizations o on o.id=d.restaurant_id join public.zones z on z.id=d.zone_id order by z.name,d.distributed_on`)
await q('sums', `select z.name,z.flyers_distributed,coalesce(sum(d.count),0) hist from public.zones z left join public.flyer_distributions d on d.zone_id=z.id group by z.id,z.name,z.flyers_distributed order by z.name`)
await q('campaign index', `select indexname,indexdef from pg_indexes where tablename='campaigns'`)
await q('rpc exists', `select proname,pg_get_function_identity_arguments(oid) args,prosecdef from pg_proc where proname='admin_set_zone_flyers'`)
await q('policies', `select policyname,cmd,roles from pg_policies where tablename='flyer_distributions' order by policyname`)
await c.end()
