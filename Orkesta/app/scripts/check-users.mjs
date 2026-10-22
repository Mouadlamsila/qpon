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
const r = await c.query(`select email, id from auth.users where email in ('foued@orkesta.com','crousty@orkesta.com')`)
console.log(JSON.stringify(r.rows, null, 2))
const p = await c.query(`select email, role, organization_id from public.profiles`)
console.log('profiles:', JSON.stringify(p.rows))
await c.end()
