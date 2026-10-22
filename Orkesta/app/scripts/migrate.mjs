// Migration runner — pooler 6543 (5432 direct est instable : ECONNRESET).
// Fallback 5432 si le pooler refuse. Dev only.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'

function env(name) {
  const line = readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .find((l) => l.startsWith(`${name}=`))
  return line ? line.slice(name.length + 1).trim() : ''
}

const ref = new URL(env('VITE_SUPABASE_URL')).hostname.split('.')[0]
const password = env('VITE_SUPABASE_DB_PASSWORD')

const candidates = [
  { host: 'aws-0-eu-north-1.pooler.supabase.com', port: 6543, user: `postgres.${ref}` },
  { host: `db.${ref}.supabase.co`, port: 5432, user: 'postgres' },
]

const dir = join(import.meta.dirname, '..', 'supabase', 'migrations')
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()

let db
for (const c of candidates) {
  const client = new pg.Client({ ...c, password, database: 'postgres', ssl: { rejectUnauthorized: false } })
  try {
    await client.connect()
    db = client
    console.log(`connected ${c.host}:${c.port}`)
    break
  } catch (e) {
    console.warn(`connect ${c.host}:${c.port} failed: ${e.message}`)
    await client.end().catch(() => {})
  }
}
if (!db) throw new Error('aucune connexion Postgres')

for (const f of files) {
  const sql = readFileSync(join(dir, f), 'utf8')
  process.stdout.write(`→ ${f} ... `)
  await db.query(sql)
  process.stdout.write('OK\n')
}
await db.end()
console.log('All migrations applied.')
