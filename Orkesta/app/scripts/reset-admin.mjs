// Clean reset Foued admin: delete → fresh signup → confirm (users + identities) → profile → test login.
import { readFileSync } from 'node:fs'
import pg from 'pg'
const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split(/\r?\n/).filter((l) => l.includes('='))
    .map((l) => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()] }),
)
const url = env.VITE_SUPABASE_URL
const anon = env.VITE_SUPABASE_ANON_KEY
const EMAIL = 'foued@orkesta.com'
const PASSWORD = 'foued2026'
const ref = new URL(url).hostname.split('.')[0]
const mk = () => new pg.Client({ host: 'aws-0-eu-north-1.pooler.supabase.com', port: 6543, user: 'postgres.' + ref, password: env.VITE_SUPABASE_DB_PASSWORD, database: 'postgres', ssl: { rejectUnauthorized: false } })

// 1. delete existing (cascade → identities; profiles FK cascade)
let c = await mk(); await c.connect()
await c.query(`delete from auth.users where email=$1`, [EMAIL])
console.log('deleted old user')
await c.end()

// 2. fresh signup
const su = await fetch(`${url}/auth/v1/signup`, { method: 'POST', headers: { apikey: anon, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: EMAIL, password: PASSWORD }) })
const b = await su.json().catch(() => ({}))
console.log(`signup: ${su.status} ${b.msg ?? ''} id=${b.id ?? b.user?.id ?? ''}`)
if (su.status !== 200 && !b.id && !b.user?.id) { console.log('FAIL signup'); process.exit(1) }

// 3. wait (rate limit) + confirm properly
await new Promise((r) => setTimeout(r, 2000))
c = await mk(); await c.connect()
const u = await c.query(`select id from auth.users where email=$1`, [EMAIL])
const uid = u.rows[0]?.id
if (!uid) { console.log('FAIL: no user after signup'); await c.end(); process.exit(1) }
await c.query(`update auth.users set email_confirmed_at = now() where id=$1`, [uid])
await c.query(`update auth.identities set identity_data = jsonb_set(identity_data, '{email_verified}', 'true') where user_id=$1`, [uid])
// 4. profile
const org = await c.query(`select id from public.organizations where name='Crousty Verviers' limit 1`)
await c.query(`insert into public.profiles (id,email,role,organization_id) values ($1,$2,'admin_foued',$3) on conflict (id) do update set role='admin_foued', organization_id=$3`, [uid, EMAIL, org.rows[0]?.id])
console.log('confirmed + profile set')
await c.end()

// 5. test login
await new Promise((r) => setTimeout(r, 1500))
const si = await fetch(`${url}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: anon, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: EMAIL, password: PASSWORD }) })
const tok = await si.json()
console.log(`login: ${si.status} ${tok.msg ?? ''}`)
if (tok.access_token) {
  const orders = await (await fetch(`${url}/rest/v1/orders?select=id`, { headers: { apikey: anon, Authorization: `Bearer ${tok.access_token}` } })).json()
  console.log('✅ LOGIN OK — orders visible (admin):', Array.isArray(orders) ? orders.length : orders)
} else console.log('❌ login still failing')
