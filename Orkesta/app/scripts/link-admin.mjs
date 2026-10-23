// Link dashboard-created user → profile (admin_foued) + verify login. No signup (avoids rate limit).
import { readFileSync } from 'node:fs'
import pg from 'pg'
const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split(/\r?\n/).filter((l) => l.includes('='))
    .map((l) => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()] }),
)
const url = env.VITE_SUPABASE_URL, anon = env.VITE_SUPABASE_ANON_KEY
const EMAIL = 'foued@orkesta.com', PASSWORD = env.ADMIN_PASSWORD
if (!PASSWORD) throw new Error('ADMIN_PASSWORD manquant dans .env')
const ref = new URL(url).hostname.split('.')[0]
const c = new pg.Client({ host: 'aws-0-eu-north-1.pooler.supabase.com', port: 6543, user: 'postgres.' + ref, password: env.VITE_SUPABASE_DB_PASSWORD, database: 'postgres', ssl: { rejectUnauthorized: false } })
await c.connect()

const u = await c.query(`select id, email_confirmed_at from auth.users where email=$1 limit 1`, [EMAIL])
if (!u.rows[0]) { console.log('FAIL: user ma kaynch f auth.users — tzad f Dashboard?'); await c.end(); process.exit(1) }
const uid = u.rows[0].id
console.log('user found:', uid, 'confirmed:', u.rows[0].email_confirmed_at ? 'yes' : 'no (auto-confirm off)')

// ensure confirmed (safe: only email_confirmed_at, no token tamper)
if (!u.rows[0].email_confirmed_at) { await c.query(`update auth.users set email_confirmed_at=now() where id=$1`, [uid]); console.log('→ confirmed') }

const org = await c.query(`select id from public.organizations where name='Crousty Verviers' limit 1`)
await c.query(`insert into public.profiles (id,email,role,organization_id) values ($1,$2,'admin_foued',$3) on conflict (id) do update set role='admin_foued', organization_id=$3`, [uid, EMAIL, org.rows[0]?.id])
console.log('profile: admin_foued linked org', org.rows[0]?.id)
await c.end()

// test login
const si = await fetch(`${url}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: anon, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: EMAIL, password: PASSWORD }) })
const tok = await si.json()
console.log(`login: ${si.status} ${tok.msg ?? ''}`)
if (tok.access_token) {
  const H = { apikey: anon, Authorization: `Bearer ${tok.access_token}` }
  const prof = await (await fetch(`${url}/rest/v1/profiles?select=role,organization_id`, { headers: H })).json()
  const orders = await (await fetch(`${url}/rest/v1/orders?select=id,amount`, { headers: H })).json()
  const zones = await (await fetch(`${url}/rest/v1/zones?select=name`, { headers: H })).json()
  console.log('✅ profile:', JSON.stringify(prof))
  console.log('✅ orders (admin):', Array.isArray(orders) ? orders.length : orders)
  console.log('✅ zones (admin):', Array.isArray(zones) ? zones.length : zones)
  console.log(Array.isArray(orders) && orders.length > 0 ? '\n🎉 ADMIN RLS BYPASS — data visible' : '\n⚠️ 0 rows')
} else console.log('❌ login failed')
