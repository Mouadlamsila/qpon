// Confirme le compte restaurant + profil + vérifie login/RLS/insert.
import { readFileSync } from 'node:fs'
import pg from 'pg'
const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split(/\r?\n/).filter((l) => l.includes('='))
    .map((l) => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()] }),
)
const EMAIL = 'crousty@orkesta.com'
const PASSWORD = 'crousty2026'
const ref = new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0]
const c = new pg.Client({ host: 'aws-0-eu-north-1.pooler.supabase.com', port: 6543, user: 'postgres.' + ref, password: env.VITE_SUPABASE_DB_PASSWORD, database: 'postgres', ssl: { rejectUnauthorized: false } })
await c.connect()

const u = await c.query(`select id, email_confirmed_at from auth.users where email=$1`, [EMAIL])
if (!u.rows[0]) { console.log('FAIL: user ma kaynch'); process.exit(1) }
const uid = u.rows[0].id
console.log('user:', uid, '| confirmed:', Boolean(u.rows[0].email_confirmed_at))

if (!u.rows[0].email_confirmed_at) {
  await c.query(`update auth.users set email_confirmed_at=now(), updated_at=now() where id=$1`, [uid])
  console.log('→ email confirmé')
}

const org = await c.query(`select id from public.organizations where name='Crousty Verviers' limit 1`)
const orgId = org.rows[0].id
await c.query(
  `insert into public.profiles (id,email,role,organization_id) values ($1,$2,'server_restaurant',$3)
   on conflict (id) do update set email=excluded.email, role='server_restaurant', organization_id=excluded.organization_id`,
  [uid, EMAIL, orgId],
)
console.log('→ profile server_restaurant lié org', orgId)
await c.end()

// Login
const li = await fetch(`${env.VITE_SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: env.VITE_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
})
const tok = await li.json()
console.log('login:', li.status, tok.error_description ?? tok.msg ?? 'OK')
if (!tok.access_token) process.exit(1)

const H = { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${tok.access_token}` }
const zones = await (await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/zones?select=id,name`, { headers: H })).json()
const profile = await (await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/profiles?select=role,organization_id`, { headers: H })).json()
const promos = await (await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/promos?select=id&limit=1`, { headers: H })).json()
console.log('profile:', JSON.stringify(profile))
console.log('zones:', Array.isArray(zones) ? zones.length : zones)

// Insert order (RLS tenant doit passer)
const testId = crypto.randomUUID()
const ins = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/orders`, {
  method: 'POST',
  headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
  body: JSON.stringify({ id: testId, restaurant_id: orgId, zone_id: zones[0].id, promo_id: promos[0].id, channel: 'SUR_PLACE', amount: 1 }),
})
console.log('insert order:', ins.status, ins.status < 300 ? 'OK' : await ins.text())
await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/orders?id=eq.${testId}`, { method: 'DELETE', headers: H })
console.log('→ test order supprimée')
