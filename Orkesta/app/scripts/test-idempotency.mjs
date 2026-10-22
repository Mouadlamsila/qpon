// P2 idempotency test: upsert same client_uuid 2x → must stay 1 row. Then cleanup.
import { readFileSync } from 'node:fs'
const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split(/\r?\n/).filter((l) => l.includes('='))
    .map((l) => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()] }),
)
const url = env.VITE_SUPABASE_URL, anon = env.VITE_SUPABASE_ANON_KEY

// login admin
const si = await fetch(`${url}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: anon, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'foued@orkesta.com', password: 'foued2026' }) })
const tok = await si.json()
if (!tok.access_token) { console.log('FAIL login'); process.exit(1) }
const H = { apikey: anon, Authorization: `Bearer ${tok.access_token}`, 'Content-Type': 'application/json' }

// get valid zone/promo ids
const zones = await (await fetch(`${url}/rest/v1/zones?select=id&limit=1`, { headers: H })).json()
const promos = await (await fetch(`${url}/rest/v1/promos?select=id&limit=1`, { headers: H })).json()
const org = await (await fetch(`${url}/rest/v1/organizations?select=id&limit=1`, { headers: H })).json()
const row = { id: crypto.randomUUID(), restaurant_id: org[0].id, zone_id: zones[0].id, promo_id: promos[0].id, channel: 'UBER', amount: 99 }

// push #1
const p1 = await fetch(`${url}/rest/v1/orders`, { method: 'POST', headers: H, body: JSON.stringify([row]) })
console.log(`push#1: ${p1.status}`)
// push #2 (SAME client_uuid = simulated retry/duplicate)
const p2 = await fetch(`${url}/rest/v1/orders`, { method: 'POST', headers: H, body: JSON.stringify([row]) })
console.log(`push#2 (same uuid): ${p2.status} ${p2.ok ? '' : (await p2.text()).slice(0,120)}`)

// count rows with this id
const chk = await (await fetch(`${url}/rest/v1/orders?id=eq.${row.id}&select=id`, { headers: H })).json()
console.log(`rows with client_uuid=${row.id}: ${chk.length}  ${chk.length === 1 ? '✅ IDEMPOTENT (no dup)' : '❌ DUPLICATE'}`)

// cleanup test row
const del = await fetch(`${url}/rest/v1/orders?id=eq.${row.id}`, { method: 'DELETE', headers: H })
console.log(`cleanup: ${del.status}`)

// final orders count (should be back to 5)
const all = await (await fetch(`${url}/rest/v1/orders?select=id`, { headers: H })).json()
console.log(`total orders after cleanup: ${all.length}`)
console.log(chk.length === 1 ? '\n🎉 P2 IDEMPOTENCY OK' : '\n❌ idempotency broken')
