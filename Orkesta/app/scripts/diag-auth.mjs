// Diagnose auth user row state.
import { readFileSync } from 'node:fs'
import pg from 'pg'
const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split(/\r?\n/).filter((l) => l.includes('='))
    .map((l) => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()] }),
)
const ref = new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0]
const c = new pg.Client({ host: 'aws-0-eu-north-1.pooler.supabase.com', port: 6543, user: 'postgres.' + ref, password: env.VITE_SUPABASE_DB_PASSWORD, database: 'postgres', ssl: { rejectUnauthorized: false } })
await c.connect()
const u = await c.query(`select id, email, email_confirmed_at, confirmation_token, recovery_token, encrypted_password is not null as has_pw, raw_app_meta_data, created_at from auth.users where email=$1`, ['foued@orkesta.com'])
console.log('USER:', JSON.stringify(u.rows[0], null, 2))
const ident = await c.query(`select id, provider, provider_id, identity_data from auth.identities where user_id=$1`, [u.rows[0]?.id])
console.log('IDENTITIES:', JSON.stringify(ident.rows, null, 2))
await c.end()
