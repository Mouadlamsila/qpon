// Verify full admin flow: signIn → token → REST sees data (RLS admin bypass).
import { readFileSync } from 'node:fs'
const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split(/\r?\n/).filter((l) => l.includes('='))
    .map((l) => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()] }),
)
const url = env.VITE_SUPABASE_URL
const anon = env.VITE_SUPABASE_ANON_KEY

// 1. signIn
const si = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: anon, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'foued@orkesta.com', password: 'foued2026' }),
})
const tok = await si.json()
console.log(`signIn: ${si.status} ${tok.msg ?? ''}`)
if (!tok.access_token) { console.log('FAIL no token'); process.exit(1) }

// 2. profile role
const H = { apikey: anon, Authorization: `Bearer ${tok.access_token}` }
const prof = await (await fetch(`${url}/rest/v1/profiles?select=role,organization_id`, { headers: H })).json()
console.log('profile via REST:', JSON.stringify(prof))

// 3. orders (admin bypass → khass ychouf data)
const orders = await (await fetch(`${url}/rest/v1/orders?select=id,channel,amount`, { headers: H })).json()
console.log('orders count (admin):', Array.isArray(orders) ? orders.length : orders)

// 4. zones
const zones = await (await fetch(`${url}/rest/v1/zones?select=name,flyers_distributed`, { headers: H })).json()
console.log('zones (admin):', Array.isArray(zones) ? zones.length : zones)
console.log(Array.isArray(orders) && orders.length > 0 ? '\n✅ ADMIN RLS BYPASS WORKS — data visible' : '\n⚠️ admin sees 0 rows')
