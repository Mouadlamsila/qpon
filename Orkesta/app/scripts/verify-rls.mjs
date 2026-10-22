// Vérifie le durcissement RLS sur le vrai Supabase :
//   anon = 0 row · tenant isolé · pas d'escalade admin · pas d'UPDATE/DELETE restaurant.
// Usage : node scripts/verify-rls.mjs   (exit 1 si un test échoue)
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()])
)

const URL_ = env.VITE_SUPABASE_URL
const ANON = env.VITE_SUPABASE_ANON_KEY
if (!URL_ || !ANON) throw new Error('VITE_SUPABASE_URL / ANON_KEY manquants')

let pass = 0
let fail = 0
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name} ${detail}`) }
}

async function api(path, { method = 'GET', token, body, prefer } = {}) {
  const res = await fetch(`${URL_}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${token ?? ANON}`,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const text = await res.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  return { status: res.status, ok: res.ok, data }
}

async function signIn(email, password) {
  const res = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`login ${email}: ${data.error_description ?? data.msg ?? res.status}`)
  return { token: data.access_token, uid: data.user.id }
}

const restaurant = await signIn('crousty@orkesta.com', env.RESTAURANT_PASSWORD)
const admin = await signIn('foued@orkesta.com', env.ADMIN_PASSWORD)

const ids = { zone: randomUUID(), promo: randomUUID(), order: randomUUID() }

console.log('\n[1] anon — aucune donnée')
for (const t of ['organizations', 'zones', 'promos', 'orders', 'profiles', 'campaigns', 'devices']) {
  const r = await api(`${t}?select=*`)
  ok(`${t} → []`, r.ok && Array.isArray(r.data) && r.data.length === 0, `status=${r.status} rows=${r.data?.length}`)
}
const anonWrite = await api('zones', { method: 'POST', body: { id: randomUUID(), restaurant_id: randomUUID(), name: 'x', code: 'x', color: '#000' } })
ok('anon POST zones → refusé', !anonWrite.ok, `status=${anonWrite.status}`)

console.log('\n[2] restaurant — tenant isolé')
const rOrgs = await api('organizations?select=id', { token: restaurant.token })
const orgId = rOrgs.data?.[0]?.id
ok('1 seule organization', rOrgs.ok && rOrgs.data.length === 1, `rows=${rOrgs.data?.length}`)
const rProf = await api(`profiles?select=role,organization_id&id=eq.${restaurant.uid}`, { token: restaurant.token })
ok('profil = server_restaurant + son org', rProf.data?.[0]?.role === 'server_restaurant' && rProf.data?.[0]?.organization_id === orgId)
const rOrders = await api('orders?select=restaurant_id', { token: restaurant.token })
ok('orders = uniquement son org', rOrders.ok && rOrders.data.every((o) => o.restaurant_id === orgId), `rows=${rOrders.data?.length}`)

console.log('\n[3] restaurant — anti-escalade / anti-destruction')
await api(`profiles?id=eq.${restaurant.uid}`, { method: 'PATCH', token: restaurant.token, body: { role: 'admin_foued' }, prefer: 'return=representation' })
const roleAfter = await api(`profiles?select=role&id=eq.${restaurant.uid}`, { token: restaurant.token })
ok('PATCH role → refusé', roleAfter.data?.[0]?.role === 'server_restaurant', `role=${roleAfter.data?.[0]?.role}`)

const newZone = { id: ids.zone, restaurant_id: orgId, name: 'RLS TEST', code: 'RLSTEST', color: '#000000' }
const insZone = await api('zones', { method: 'POST', token: restaurant.token, body: newZone, prefer: 'return=representation' })
ok('INSERT zone autorisée', insZone.ok, `status=${insZone.status}`)
const dupZone = await api('zones', { method: 'POST', token: restaurant.token, body: newZone, prefer: 'return=representation,resolution=ignore-duplicates' })
ok('rejeu idempotent (ignore-duplicates)', dupZone.ok, `status=${dupZone.status}`)

await api(`zones?id=eq.${ids.zone}`, { method: 'PATCH', token: restaurant.token, body: { name: 'HACKED' } })
const zoneAfterPatch = await api(`zones?select=name&id=eq.${ids.zone}`, { token: restaurant.token })
ok('PATCH zone → refusé', zoneAfterPatch.data?.[0]?.name === 'RLS TEST', `name=${zoneAfterPatch.data?.[0]?.name}`)

await api(`zones?id=eq.${ids.zone}`, { method: 'DELETE', token: restaurant.token })
const zoneAfterDelete = await api(`zones?select=id&id=eq.${ids.zone}`, { token: restaurant.token })
ok('DELETE zone → refusé', zoneAfterDelete.data?.length === 1)

const newPromo = { id: ids.promo, restaurant_id: orgId, name: 'RLS TEST', price_place: 1, price_delivery: 1, active: true }
const insPromo = await api('promos', { method: 'POST', token: restaurant.token, body: newPromo, prefer: 'return=representation' })
ok('INSERT promo autorisée', insPromo.ok, `status=${insPromo.status}`)

const newOrder = { id: ids.order, restaurant_id: orgId, zone_id: ids.zone, promo_id: ids.promo, channel: 'SUR_PLACE', amount: 1 }
const insOrder = await api('orders', { method: 'POST', token: restaurant.token, body: newOrder, prefer: 'return=representation' })
ok('INSERT order autorisée', insOrder.ok, `status=${insOrder.status}`)

const crossOrder = await api('orders', { method: 'POST', token: restaurant.token, body: { ...newOrder, id: randomUUID(), restaurant_id: randomUUID() } })
ok('INSERT order autre org → refusé', !crossOrder.ok, `status=${crossOrder.status}`)

await api(`orders?id=eq.${ids.order}`, { method: 'PATCH', token: restaurant.token, body: { amount: 999 } })
const orderAfterPatch = await api(`orders?select=amount&id=eq.${ids.order}`, { token: restaurant.token })
ok('PATCH order → refusé', Number(orderAfterPatch.data?.[0]?.amount) === 1, `amount=${orderAfterPatch.data?.[0]?.amount}`)

await api(`orders?id=eq.${ids.order}`, { method: 'DELETE', token: restaurant.token })
const orderAfterDelete = await api(`orders?select=id&id=eq.${ids.order}`, { token: restaurant.token })
ok('DELETE order → refusé', orderAfterDelete.data?.length === 1)

console.log('\n[4] admin — contrôle total (cleanup)')
const aOrgs = await api('organizations?select=id', { token: admin.token })
ok('admin voit les organizations', aOrgs.ok && aOrgs.data.length >= 1, `rows=${aOrgs.data?.length}`)
const delOrder = await api(`orders?id=eq.${ids.order}`, { method: 'DELETE', token: admin.token })
const delPromo = await api(`promos?id=eq.${ids.promo}`, { method: 'DELETE', token: admin.token })
const delZone = await api(`zones?id=eq.${ids.zone}`, { method: 'DELETE', token: admin.token })
ok('admin DELETE order/promo/zone', delOrder.ok && delPromo.ok && delZone.ok, `${delOrder.status}/${delPromo.status}/${delZone.status}`)

console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
