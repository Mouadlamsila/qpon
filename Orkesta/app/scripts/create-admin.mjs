// Create/fix Foued admin: find auth user by email, confirm it, add profile.
// Idempotent. Dev only.
import { readFileSync } from 'node:fs'
import pg from 'pg'

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split(/\r?\n/).filter((l) => l.includes('='))
    .map((l) => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()] }),
)
const url = env.VITE_SUPABASE_URL
const anon = env.VITE_SUPABASE_ANON_KEY
const EMAIL = 'foued@orkesta.com'
const PASSWORD = env.ADMIN_PASSWORD
if (!PASSWORD) throw new Error('ADMIN_PASSWORD manquant dans .env')

// 1. try signup (ignore "already exists")
const su = await fetch(`${url}/auth/v1/signup`, {
  method: 'POST', headers: { apikey: anon, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
})
const b = await su.json().catch(() => ({}))
console.log(`signup: ${su.status} ${b.msg ?? ''}`)

// 2. direct connection
const ref = new URL(url).hostname.split('.')[0]
const c = new pg.Client({ host: 'aws-0-eu-north-1.pooler.supabase.com', port: 6543, user: 'postgres.' + ref, password: env.VITE_SUPABASE_DB_PASSWORD, database: 'postgres', ssl: { rejectUnauthorized: false } })
await c.connect()

// 3. find user id in auth.users
const u = await c.query(`select id, email_confirmed_at from auth.users where email=$1 limit 1`, [EMAIL])
if (!u.rows[0]) { console.log('FAIL: user ma kaynch f auth.users'); await c.end(); process.exit(1) }
const userId = u.rows[0].id
console.log('user id:', userId, 'confirmed_at:', u.rows[0].email_confirmed_at ?? 'NULL')

// 4. confirm email (dev workaround — disable confirmation requirement)
await c.query(`update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now()), confirmation_token = NULL, recovery_token = NULL where id=$1`, [userId])

// 5. profile role=admin_foued + link org
const org = await c.query(`select id from public.organizations where name='Crousty Verviers' limit 1`)
const orgId = org.rows[0]?.id
await c.query(
  `insert into public.profiles (id,email,role,organization_id) values ($1,$2,'admin_foued',$3)
   on conflict (id) do update set role='admin_foued', organization_id=$3`,
  [userId, EMAIL, orgId],
)
const p = await c.query(`select role, organization_id from public.profiles where id=$1`, [userId])
console.log('profile:', JSON.stringify(p.rows[0]))
await c.end()
console.log(`\n✅ LOGIN: ${EMAIL} / ${PASSWORD}`)
