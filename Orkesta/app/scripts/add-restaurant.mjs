// Fallback local (sans Edge Function) : crée org + compte tablette + profil.
// Usage : node scripts/add-restaurant.mjs "Crousty Dison" dison@orkesta.com "motdepasse≥8"
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import pg from 'pg'

const [name, email, password] = process.argv.slice(2)
if (!name || !email || !password || password.length < 8) {
  console.log('Usage: node scripts/add-restaurant.mjs "Nom" email "motdepasse (≥8)"')
  process.exit(1)
}

function env(k) {
  const line = readFileSync('.env', 'utf8').split(/\r?\n/).find((l) => l.startsWith(`${k}=`))
  return line ? line.slice(k.length + 1).trim() : ''
}

const url = env('VITE_SUPABASE_URL')
const anon = env('VITE_SUPABASE_ANON_KEY')
const ref = new URL(url).hostname.split('.')[0]
const db = new pg.Client({
  host: 'aws-0-eu-north-1.pooler.supabase.com',
  port: 6543,
  user: `postgres.${ref}`,
  password: env('VITE_SUPABASE_DB_PASSWORD'),
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
})

await db.connect()
const orgId = randomUUID()
await db.query('insert into public.organizations (id, name) values ($1, $2)', [orgId, name])

const res = await fetch(`${url}/auth/v1/signup`, {
  method: 'POST',
  headers: { apikey: anon, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
})
const data = await res.json()
const uid = data.user?.id ?? data.id
if (!res.ok || !uid) {
  await db.query('delete from public.organizations where id = $1', [orgId]).catch(() => {})
  await db.end()
  throw new Error(`signup: ${data.msg ?? data.error_description ?? res.status}`)
}

try {
  // Confirme l'email (pas de mail en démo) + rattache le profil au tenant.
  await db.query(
    `update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now() where id = $1`,
    [uid]
  )
  await db.query(
    `insert into public.profiles (id, email, role, organization_id)
     values ($1, $2, 'server_restaurant', $3)
     on conflict (id) do update
       set email = excluded.email, role = excluded.role, organization_id = excluded.organization_id`,
    [uid, email, orgId]
  )
} catch (e) {
  // Rollback complet : auth user (cascade profil) puis org.
  await db.query('delete from auth.users where id = $1', [uid]).catch(() => {})
  await db.query('delete from public.organizations where id = $1', [orgId]).catch(() => {})
  throw e
} finally {
  await db.end()
}

console.log(`✅ ${name}`)
console.log(`   org  : ${orgId}`)
console.log(`   user : ${uid}`)
console.log(`   login: ${email} / ${password}`)
