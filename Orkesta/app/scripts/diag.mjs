// Diagnostic: tables, grants, RLS. Dev only.
import { readFileSync } from 'node:fs'
import pg from 'pg'

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split(/\r?\n/).filter((l) => l.includes('='))
    .map((l) => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()] }),
)
const ref = new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0]
const c = new pg.Client({
  host: 'aws-0-eu-north-1.pooler.supabase.com', port: 6543,
  user: 'postgres.' + ref, password: env.VITE_SUPABASE_DB_PASSWORD,
  database: 'postgres', ssl: { rejectUnauthorized: false },
})
await c.connect()
const show = async (label, sql) => {
  try { const r = await c.query(sql); console.log(`--- ${label} ---`); for (const row of r.rows) console.log(' ', JSON.stringify(row)) }
  catch (e) { console.log(`--- ${label} --- ERR: ${e.message.split('\n')[0]}`) }
}
await show('tables', `select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1`)
await show('grants-anon', `select table_name, privilege_type from information_schema.role_table_grants where table_schema='public' and grantee='anon' order by 1,2`)
await show('rls-enabled', `select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' order by 1`)
await show('pgrst-exposed', `select * from supabase_migrations.schema_migrations order by version desc limit 3`).catch(() => {})
await c.end()
