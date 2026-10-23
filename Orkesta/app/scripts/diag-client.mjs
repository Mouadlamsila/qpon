import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

const { data: auth, error: authErr } = await sb.auth.signInWithPassword({
  email: 'foued@orkesta.com',
  password: process.env.ADMIN_PASSWORD ?? '',
})
console.log('signIn:', authErr ? 'ERR ' + authErr.message : 'OK', auth.user?.email)

// === exact admin.ts isAdmin ===
const { data: u } = await sb.auth.getUser()
const { data: prof, error: profErr } = await sb.from('profiles').select('role').eq('id', u.user.id).single()
console.log('profiles.single():', prof, profErr?.message ?? '')

// === exact admin.ts loadDashboard ===
const [zonesRes, ordersRes] = await Promise.all([
  sb.from('zones').select('id, name, code, color, flyers_distributed'),
  sb.from('orders').select('id, channel, amount, created_at, zone_id, zones(name, color), promos(name)').order('created_at', { ascending: false }),
])
console.log('zones :', zonesRes.error ? 'ERR ' + zonesRes.error.message : `${zonesRes.data.length} rows`)
console.log('orders:', ordersRes.error ? 'ERR ' + ordersRes.error.message : `${ordersRes.data.length} rows`)
if (ordersRes.data?.[0]) console.log('order sample:', JSON.stringify(ordersRes.data[0]))

// === session shape (expiry) ===
const { data: s } = await sb.auth.getSession()
console.log('session expires_at:', s.session?.expires_at, '→', new Date((s.session?.expires_at ?? 0) * 1000).toISOString())
