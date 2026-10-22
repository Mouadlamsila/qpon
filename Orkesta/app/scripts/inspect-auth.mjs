// Inspecte la forme exacte d'un user auth Supabase (pour en créer un identique).
import { readFileSync } from 'node:fs'
import pg from 'pg'

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split(/\r?\n/).filter((l) => l.includes('='))
    .map((l) => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()] }),
)
const ref = new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0]
const c = new pg.Client({ host: 'aws-0-eu-north-1.pooler.supabase.com', port: 6543, user: 'postgres.' + ref, password: env.VITE_SUPABASE_DB_PASSWORD, database: 'postgres', ssl: { rejectUnauthorized: false } })
await c.connect()

const u = await c.query(`select * from auth.users where email='foued@orkesta.com' limit 1`)
const r = u.rows[0]
console.log('auth.users columns:', Object.keys(r).join(', '))
console.log('instance_id:', r.instance_id, '| aud:', r.aud, '| role:', r.role)
console.log('raw_app_meta_data:', JSON.stringify(r.raw_app_meta_data))
console.log('raw_user_meta_data:', JSON.stringify(r.raw_user_meta_data))
console.log('encrypted_password[:7]:', String(r.encrypted_password).slice(0, 7), '| len', String(r.encrypted_password).length)
console.log('is_sso_user:', r.is_sso_user, '| is_anonymous:', r.is_anonymous, '| confirmed:', r.email_confirmed_at)

const i = await c.query(`select * from auth.identities where user_id=$1`, [r.id])
console.log('identities columns:', Object.keys(i.rows[0] ?? {}).join(', '))
console.log('identity:', JSON.stringify({ ...i.rows[0], identity_data: i.rows[0]?.identity_data }))

const hasCrypt = await c.query(`select extensions.crypt('test', extensions.gen_salt('bf')) as h`)
console.log('pgcrypto crypt OK:', String(hasCrypt.rows[0].h).slice(0, 7))

await c.end()
