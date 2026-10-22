// Crée (ou recrée) le compte tablette du restaurant — même forme que l'admin.
// Pas de signup public : insert direct auth.users (bcrypt) + identity + profile.
import { readFileSync } from 'node:fs'
import pg from 'pg'

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split(/\r?\n/).filter((l) => l.includes('='))
    .map((l) => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()] }),
)
const ref = new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0]
const c = new pg.Client({ host: 'aws-0-eu-north-1.pooler.supabase.com', port: 5432, user: 'postgres.' + ref, password: env.VITE_SUPABASE_DB_PASSWORD, database: 'postgres', ssl: { rejectUnauthorized: false } })
await c.connect()
console.log('connected')
const ORG_NAME = 'Crousty Verviers'

const EMAIL = 'crousty@orkesta.com'
const PASSWORD = 'crousty2026'

const org = await c.query(`select id from public.organizations where name=$1 limit 1`, [ORG_NAME])
if (!org.rows[0]) { console.log('FAIL: org introuvable'); await c.end(); process.exit(1) }
const orgId = org.rows[0].id
console.log('org:', orgId)

try {
  // Idempotent : recrée proprement ce compte (FK profiles on delete cascade).
  console.log('1. delete existing…')
  await c.query(`delete from auth.users where email=$1`, [EMAIL])

  console.log('2. insert auth.users…')
  const ins = await c.query(
    `insert into auth.users (
       instance_id, id, aud, role, email, encrypted_password,
       email_confirmed_at, created_at, updated_at,
       raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
     ) values (
       '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
       $1, extensions.crypt($2, extensions.gen_salt('bf')),
       now(), now(), now(),
       '{"provider":"email","providers":["email"]}'::jsonb,
       '{"email_verified":true}'::jsonb,
       false, false
     ) returning id`,
    [EMAIL, PASSWORD],
  )
  const uid = ins.rows[0].id
  console.log('   uid:', uid)

  console.log('3. insert auth.identities…')
  await c.query(
    `insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, email)
     values ($1, $1, jsonb_build_object('sub', $1::text, 'email', $2, 'email_verified', true, 'phone_verified', false), 'email', now(), now(), now(), $2)`,
    [uid, EMAIL],
  )

  console.log('4. insert public.profiles…')
  await c.query(
    `insert into public.profiles (id, email, role, organization_id)
     values ($1, $2, 'server_restaurant', $3)
     on conflict (id) do update set email=excluded.email, role='server_restaurant', organization_id=excluded.organization_id`,
    [uid, EMAIL, orgId],
  )

  console.log('✅ user créé :', uid)
  console.log('   email   :', EMAIL)
  console.log('   role    : server_restaurant')
  console.log('   org     :', ORG_NAME, orgId)
} catch (e) {
  console.log('FAIL:', e.message)
  await c.end()
  process.exit(1)
}
await c.end()

// Vérif login + RLS tenant
const si = await fetch(`${env.VITE_SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: env.VITE_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
})
const tok = await si.json()
console.log('login:', si.status, tok.msg ?? tok.error_description ?? 'OK')
if (!tok.access_token) process.exit(1)

const H = { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${tok.access_token}` }
const orders = await (await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/orders?select=id`, { headers: H })).json()
const zones = await (await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/zones?select=id,name`, { headers: H })).json()
const prof = await (await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/profiles?select=role,organization_id`, { headers: H })).json()
console.log('profile :', JSON.stringify(prof))
console.log('zones   :', Array.isArray(zones) ? zones.length : zones)
console.log('orders  :', Array.isArray(orders) ? orders.length : orders)

// Test insert (doit passer grâce au RLS tenant)
if (Array.isArray(zones) && zones.length > 0) {
  const promos = await (await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/promos?select=id&limit=1`, { headers: H })).json()
  const testId = crypto.randomUUID()
  const insOrder = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/orders`, {
    method: 'POST',
    headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({
      id: testId, restaurant_id: orgId, zone_id: zones[0].id, promo_id: promos[0].id,
      channel: 'SUR_PLACE', amount: 1, client_last4: null,
    }),
  })
  console.log('insert order:', insOrder.status, insOrder.status < 300 ? 'OK' : await insOrder.text())
  await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/orders?id=eq.${testId}`, { method: 'DELETE', headers: H })
}
