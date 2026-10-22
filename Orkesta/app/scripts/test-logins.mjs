import { readFileSync } from 'node:fs'
const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split(/\r?\n/).filter((l) => l.includes('='))
    .map((l) => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()] }),
)
const LOGINS = [
  ['crousty@orkesta.com', env.RESTAURANT_PASSWORD],
  ['foued@orkesta.com', env.ADMIN_PASSWORD],
]
for (const [email, password] of LOGINS) {
  const li = await fetch(`${env.VITE_SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: env.VITE_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const tok = await li.json()
  console.log(`\n${email}: login ${li.status} ${tok.error_description ?? tok.msg ?? 'OK'}`)
  if (!tok.access_token) continue
  const H = { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${tok.access_token}` }
  const prof = await (await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/profiles?select=role,organization_id`, { headers: H })).json()
  const zones = await (await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/zones?select=id,name`, { headers: H })).json()
  const orders = await (await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/orders?select=id`, { headers: H })).json()
  console.log('  profile:', JSON.stringify(prof))
  console.log('  zones:', Array.isArray(zones) ? zones.length : zones, '| orders:', Array.isArray(orders) ? orders.length : orders)
}
