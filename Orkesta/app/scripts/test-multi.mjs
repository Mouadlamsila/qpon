// Vérifie l'isolation multi-tenant + le script add-restaurant (crée puis nettoie).
// Usage : node scripts/test-multi.mjs
import { execFileSync } from 'node:child_process'
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
  execFileSync(process.execPath, ['scripts/add-restaurant.mjs', name, email, password], { stdio: 'pipe' })

  const admin = createClient(url, anon)
  const { error: aErr } = await admin.auth.signInWithPassword({ email: 'foued@orkesta.com', password: env('ADMIN_PASSWORD') })
  if (aErr) throw aErr
  const orgs = await admin.from('organizations').select('id, name')
  if (orgs.error) throw orgs.error
  if (orgs.data.length < 2) throw new Error(`admin ne voit pas les 2 orgs (${orgs.data.length})`)
  const temp = orgs.data.find((o) => o.name === name)
  if (!temp) throw new Error('org temporaire absente')

  const scoped = await admin.from('orders').select('id').eq('restaurant_id', temp.id)
  if (scoped.error) throw scoped.error
  if (scoped.data.length !== 0) throw new Error('filtre restaurant: orders inattendues')

  const tenant = createClient(url, anon)
  const { error: tErr } = await tenant.auth.signInWithPassword({ email, password })
  if (tErr) throw tErr
  const tOrgs = await tenant.from('organizations').select('id, name')
  if (tOrgs.error) throw tOrgs.error
  if (tOrgs.data.length !== 1 || tOrgs.data[0].id !== temp.id) {
    throw new Error(`RLS tenant: ${tOrgs.data.length} org(s) visible(s)`)
  }

  console.log(`✅ multi-tenant OK — admin ${orgs.data.length} orgs, tenant 1 org, filtre 0 commande`)
} finally {
  await db.query('delete from public.profiles where email = $1', [email]).catch(() => {})
  await db.query('delete from auth.users where email = $1', [email]).catch(() => {})
  await db.query('delete from public.organizations where name = $1', [name]).catch(() => {})
  await db.end()
  console.log('🧹 temp nettoyé')
}
