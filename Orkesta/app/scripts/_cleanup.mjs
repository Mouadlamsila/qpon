import { readFileSync, writeFileSync } from 'node:fs'
import pg from 'pg'

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
)
const ref = new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0]
const c = new pg.Client({
  host: 'aws-0-eu-north-1.pooler.supabase.com', port: 6543,
  user: 'postgres.' + ref, password: env.VITE_SUPABASE_DB_PASSWORD,
  database: 'postgres', ssl: { rejectUnauthorized: false },
})
await c.connect()
const one = async (sql, p = []) => (await c.query(sql, p)).rows[0]
const count = async (sql, p = []) => Number((await one(sql, p)).n)

const org = await one(`select * from public.organizations where name = 'test' limit 1`)
const zone = await one(`select * from public.zones where lower(name) = 'test' or lower(code) = 'test' limit 1`)
const profile = await one(`select * from public.profiles where email = 'test@gmail.com' limit 1`)
if (!org && !zone && !profile) {
  console.log('already clean')
  await c.end()
  process.exit(0)
}

const backup = {
  created_at: new Date().toISOString(),
  organizations: org ? [org] : [],
  zones: zone ? [zone] : [],
  profiles: profile ? [profile] : [],
}
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const path = `C:/Users/Administrator/AppData/Local/Temp/opencode/orkesta-test-backup-${stamp}.json`
writeFileSync(path, JSON.stringify(backup, null, 2))
console.log('backup:', path)
console.log('test org:', org?.id ?? '—', '| test zone:', zone?.id ?? '—', '| profile:', profile?.id ?? '—')

if (org) {
  const refs = {
    zones: await count(`select count(*) n from public.zones where restaurant_id=$1`, [org.id]),
    promos: await count(`select count(*) n from public.promos where restaurant_id=$1`, [org.id]),
    orders: await count(`select count(*) n from public.orders where restaurant_id=$1`, [org.id]),
    campaigns: await count(`select count(*) n from public.campaigns where restaurant_id=$1`, [org.id]),
    devices: await count(`select count(*) n from public.devices where restaurant_id=$1`, [org.id]),
    profiles: await count(`select count(*) n from public.profiles where organization_id=$1`, [org.id]),
  }
  console.log('org refs:', refs)
  if (refs.zones || refs.promos || refs.orders || refs.campaigns || refs.devices) {
    throw new Error('test org has real data — abort')
  }
}
if (zone) {
  const n = await count(`select count(*) n from public.orders where zone_id=$1`, [zone.id])
  if (n > 0) throw new Error('test zone has orders — abort')
}

await c.query('begin')
try {
  if (zone) {
    const hasDist = await one(`select to_regclass('public.flyer_distributions') as t`)
    if (hasDist?.t) await c.query(`delete from public.flyer_distributions where zone_id=$1`, [zone.id])
    await c.query(`delete from public.zones where id=$1`, [zone.id])
    console.log('deleted zone:', zone.name)
  }
  if (profile) {
    const hasSessions = await one(`select to_regclass('auth.sessions') as t`)
    const hasRefresh = await one(`select to_regclass('auth.refresh_tokens') as t`)
    if (hasSessions?.t) await c.query(`delete from auth.sessions where user_id=$1`, [profile.id])
    if (hasRefresh?.t) await c.query(`delete from auth.refresh_tokens where user_id=$1`, [profile.id])
    await c.query(`delete from auth.identities where user_id=$1`, [profile.id])
    await c.query(`delete from public.profiles where id=$1`, [profile.id])
    await c.query(`delete from auth.users where id=$1`, [profile.id])
    console.log('deleted auth user/profile:', profile.email)
  }
  if (org) {
    const left = await count(`select count(*) n from public.profiles where organization_id=$1`, [org.id])
    if (left > 0) throw new Error('profile still references test org')
    await c.query(`delete from public.organizations where id=$1`, [org.id])
    console.log('deleted org:', org.name)
  }
  const renamed = await c.query(`update public.promos set name='Tasty box famille' where name='Tasty box famillie'`)
  console.log('renamed promos:', renamed.rowCount)
  await c.query('commit')
} catch (e) {
  await c.query('rollback')
  throw e
}

console.log('\nremaining orgs:', (await c.query(`select name from public.organizations order by name`)).rows)
console.log('remaining zones:', (await c.query(`select name, code, flyers_distributed from public.zones order by name`)).rows)
console.log('remaining users:', (await c.query(`select email from public.profiles order by email`)).rows)
await c.end()
