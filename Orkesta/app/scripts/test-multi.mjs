// Vérifie la RPC d'onboarding + l'isolation multi-tenant (crée puis nettoie).
// Usage : node scripts/test-multi.mjs
import { readFileSync } from 'node:fs'
import pg from 'pg'
import { createClient } from '@supabase/supabase-js'

function env(k) {
  const line = readFileSync('.env', 'utf8').split(/\r?\n/).find((l) => l.startsWith(`${k}=`))
  return line ? line.slice(k.length + 1).trim() : ''
}
const url = env('VITE_SUPABASE_URL')
const anon = env('VITE_SUPABASE_ANON_KEY')
const ref = new URL(url).hostname.split('.')[0]

const stamp = Date.now()
const name = `ZZ Test ${stamp}`
const email = `zz-test-${stamp}@orkesta.com`
const tenantName = `ZZ Tenant ${stamp}`
const tenantEmail = `zz-tenant-${stamp}@orkesta.com`
const password = 'TestPass123!'

const db = new pg.Client({
  host: 'aws-0-eu-north-1.pooler.supabase.com',
  port: 6543,
  user: `postgres.${ref}`,
  password: env('VITE_SUPABASE_DB_PASSWORD'),
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
})
await db.connect()

try {
  // Droits : anon interdit, authenticated autorisé (le is_admin() filtre ensuite).
  const grants = await db.query(
    `select has_function_privilege('anon', 'public.admin_create_restaurant(text,text,text)', 'EXECUTE') as anon_exec,
            has_function_privilege('authenticated', 'public.admin_create_restaurant(text,text,text)', 'EXECUTE') as auth_exec`,
  )
  if (grants.rows[0].anon_exec) throw new Error('anon peut exécuter la RPC (doit être interdit)')
  if (!grants.rows[0].auth_exec) throw new Error('authenticated ne peut pas exécuter la RPC')

  // Admin : crée le restaurant via la même RPC que l'UI.
  const admin = createClient(url, anon)
  const { error: aErr } = await admin.auth.signInWithPassword({ email: 'foued@orkesta.com', password: env('ADMIN_PASSWORD') })
  if (aErr) throw aErr
  const { data: orgId, error: rpcErr } = await admin.rpc('admin_create_restaurant', {
    p_name: name, p_email: email, p_password: password,
  })
  if (rpcErr) throw rpcErr
  if (!orgId) throw new Error('RPC: org non retournée')

  const orgs = await admin.from('organizations').select('id, name')
  if (orgs.error) throw orgs.error
  if (orgs.data.length < 2) throw new Error(`admin ne voit pas les 2 orgs (${orgs.data.length})`)
  const temp = orgs.data.find((o) => o.id === orgId)
  if (temp?.name !== name) throw new Error('org temporaire absente')

  const scoped = await admin.from('orders').select('id').eq('restaurant_id', orgId)
  if (scoped.error) throw scoped.error
  if (scoped.data.length !== 0) throw new Error('filtre restaurant: orders inattendues')

  // Tenant : login OK, une seule org visible, et ne peut PAS créer de resto.
  const tenant = createClient(url, anon)
  const { error: tErr } = await tenant.auth.signInWithPassword({ email, password })
  if (tErr) throw tErr
  const tOrgs = await tenant.from('organizations').select('id, name')
  if (tOrgs.error) throw tOrgs.error
  if (tOrgs.data.length !== 1 || tOrgs.data[0].id !== orgId) {
    throw new Error(`RLS tenant: ${tOrgs.data.length} org(s) visible(s)`)
  }
  const { error: forbidErr } = await tenant.rpc('admin_create_restaurant', {
    p_name: tenantName, p_email: tenantEmail, p_password: password,
  })
  if (!forbidErr) throw new Error('un restaurant a pu créer un autre restaurant (faille)')

  console.log(`✅ RPC + multi-tenant OK — admin ${orgs.data.length} orgs, tenant 1 org, création refusée`)
} finally {
  for (const e of [email, tenantEmail]) {
    await db.query('delete from public.profiles where email = $1', [e]).catch(() => {})
    await db.query('delete from auth.users where email = $1', [e]).catch(() => {})
  }
  for (const n of [name, tenantName]) {
    await db.query('delete from public.organizations where name = $1', [n]).catch(() => {})
  }
  await db.end()
  console.log('🧹 temp nettoyé')
}
