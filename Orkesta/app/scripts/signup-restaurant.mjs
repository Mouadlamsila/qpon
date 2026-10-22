import { readFileSync } from 'node:fs'
import pg from 'pg'
const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split(/\r?\n/).filter((l) => l.includes('='))
    .map((l) => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()] }),
)
const EMAIL = 'crousty@orkesta.com'
const PASSWORD = 'crousty2026'

const r = await fetch(`${env.VITE_SUPABASE_URL}/auth/v1/signup`, {
  method: 'POST',
  headers: { apikey: env.VITE_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
})
const body = await r.json()
console.log('signup:', r.status, JSON.stringify(body).slice(0, 300))

// Confirme l'email côté DB (si le user a été créé)
const ref = new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0]
const c = new pg.Client({ host: 'aws-0-eu-north-1.pooler.supabase.com', port: 6543, user: 'postgres.' + ref, password: env.VITE_SUPABASE_DB_PASSWORD, database: 'postgres', ssl: { rejectUnauthorized: false } })
await c.connect()
const u = await c.query(`select id, email_confirmed_at from auth.users where email=$1`, [EMAIL])
console.log('auth.users:', JSON.stringify(u.rows))
if (u.rows[0] && !u.rows[0].email_confirmed_at) {
  await c.query(`update auth.users set email_confirmed_at=now(), updated_at=now() where id=$1`, [u.rows[0].id])
  console.log('→ confirmé')
}
if (u.rows[0]) {
  const org = await c.query(`select id from public.organizations where name='Crousty Verviers' limit 1`)
  await c.query(
    `insert into public.profiles (id,email,role,organization_id) values ($1,$2,'server_restaurant',$3)
     on conflict (id) do update set email=excluded.email, role='server_restaurant', organization_id=excluded.organization_id`,
    [u.rows[0].id, EMAIL, org.rows[0]?.id],
  )
  console.log('→ profile server_restaurant lié org', org.rows[0]?.id)
}
await c.end()

// Login + test RLS
const li = await fetch(`${env.VITE_SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: env.VITE_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
})
const tok = await li.json()
console.log('login:', li.status, tok.error_description ?? tok.msg ?? 'OK')
if (tok.access_token) {
  const H = { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${tok.access_token}` }
  const zones = await (await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/zones?select=id,name`, { headers: H })).json()
  const profile = await (await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/profiles?select=role,organization_id`, { headers: H })).json()
  console.log('profile:', JSON.stringify(profile), '| zones:', Array.isArray(zones) ? zones.length : zones)
}
