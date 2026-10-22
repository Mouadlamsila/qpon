import { readFileSync } from 'node:fs'
import pg from 'pg'
const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split(/\r?\n/).filter((l) => l.includes('='))
    .map((l) => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()] }),
)
const ref = new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0]
for (const port of [6543, 5432]) {
  const c = new pg.Client({ host: 'aws-0-eu-north-1.pooler.supabase.com', port, user: 'postgres.' + ref, password: env.VITE_SUPABASE_DB_PASSWORD, database: 'postgres', ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 })
  try {
    await c.connect()
    const r = await c.query('select 1 as ok, current_user')
    console.log(`port ${port}: OK`, r.rows[0])
    const u = await c.query(`select id, email from auth.users where email='crousty@orkesta.com'`)
    console.log('  auth.users:', JSON.stringify(u.rows))
    await c.end()
    break
  } catch (e) {
    console.log(`port ${port}: FAIL`, e.message)
    try { await c.end() } catch { /* ignore */ }
  }
}
