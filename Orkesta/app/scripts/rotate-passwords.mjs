// Rotation des mots de passe Supabase Auth (dev/one-shot).
// Met à jour auth.users.encrypted_password, .env (non exposé au bundle) et
// CREDENTIALS.local.md (gitignored). Les sessions JWT existantes restent valides.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import pg from 'pg'

function env(name) {
  const line = readFileSync('.env', 'utf8').split(/\r?\n/).find((l) => l.startsWith(`${name}=`))
  return line ? line.slice(name.length + 1).trim() : ''
}

const ref = new URL(env('VITE_SUPABASE_URL')).hostname.split('.')[0]
const password = env('VITE_SUPABASE_DB_PASSWORD')
const db = new pg.Client({
  host: 'aws-0-eu-north-1.pooler.supabase.com',
  port: 6543,
  user: `postgres.${ref}`,
  password,
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
})

const newPw = () => randomBytes(12).toString('base64url') // 16 chars ≈ 96 bits
const accounts = [
  { email: 'foued@orkesta.com', pw: newPw(), key: 'ADMIN_PASSWORD', label: 'Admin Foued' },
  { email: 'crousty@orkesta.com', pw: newPw(), key: 'RESTAURANT_PASSWORD', label: 'Tablette Crousty' },
]

await db.connect()
const { rows: ext } = await db.query(
  `select n.nspname as schema from pg_extension e
   join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pgcrypto'`
)
const schema = ext[0]?.schema
if (!schema) throw new Error('pgcrypto introuvable')
const crypt = `"${schema}".crypt`
const genSalt = `"${schema}".gen_salt`

for (const a of accounts) {
  const { rowCount } = await db.query(
    `update auth.users
     set encrypted_password = ${crypt}($1, ${genSalt}('bf', 10)), updated_at = now()
     where email = $2`,
    [a.pw, a.email]
  )
  if (rowCount !== 1) throw new Error(`compte introuvable ou ambigu : ${a.email} (${rowCount})`)
}
await db.end()

// .env : clés non préfixées VITE_ → jamais dans le bundle client.
let dotenv = readFileSync('.env', 'utf8')
for (const a of accounts) {
  const line = `${a.key}=${a.pw}`
  const re = new RegExp(`^${a.key}=.*$`, 'm')
  dotenv = re.test(dotenv) ? dotenv.replace(re, line) : `${dotenv.trimEnd()}\n${line}\n`
}
writeFileSync('.env', dotenv)

const md = `# Orkesta — credentials (LOCAL ONLY, gitignored)\n\n` +
  `Rotation : ${new Date().toISOString().slice(0, 10)}\n\n` +
  `| Compte | Email | Mot de passe |\n|---|---|---|\n` +
  accounts.map((a) => `| ${a.label} | \`${a.email}\` | \`${a.pw}\` |`).join('\n') +
  `\n\nPIN admin (UX) : **2026**\n`
writeFileSync('CREDENTIALS.local.md', md)

if (!existsSync('.gitignore')) throw new Error('.gitignore manquant')
const ignore = readFileSync('.gitignore', 'utf8')
if (!ignore.includes('CREDENTIALS.local.md')) {
  writeFileSync('.gitignore', `${ignore.trimEnd()}\nCREDENTIALS.local.md\n`)
}

console.log('OK — nouveaux mots de passe :')
for (const a of accounts) console.log(`  ${a.email}  ${a.pw}`)
console.log('→ écrits dans .env + CREDENTIALS.local.md (gitignored)')
