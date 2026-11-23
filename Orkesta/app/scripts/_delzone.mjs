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
const z = await c.query(`select id, restaurant_id, name from public.zones where lower(name) = 'test' or lower(code) = 'test'`)
for (const r of z.rows) {
  await c.query(`insert into public.zone_tombstones (id, restaurant_id) values ($1,$2) on conflict (id) do nothing`, [r.id, r.restaurant_id])
  await c.query(`delete from public.zones where id=$1`, [r.id])
  console.log('tombstoned + deleted', r.id, r.name)
}
console.log('zones now', (await c.query('select name from public.zones order by name')).rows)
await new Promise((r) => setTimeout(r, 30000))
console.log('zones after 30s', (await c.query('select id,name,created_at from public.zones order by name')).rows)
console.log('tombstones', (await c.query('select * from public.zone_tombstones')).rows)
await c.end()
