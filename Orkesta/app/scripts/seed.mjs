// Seed demo data via direct connection (server-side, bypasses RLS).
// Idempotent : ma kayzidch Ila org "Crousty Verviers" kayn deja.
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

const orgQ = await c.query(`select id from public.organizations where name='Crousty Verviers' limit 1`)
let orgId = orgQ.rows[0]?.id
if (!orgId) {
  orgId = (await c.query(`insert into public.organizations (name) values ('Crousty Verviers') returning id`)).rows[0].id
  console.log('org created:', orgId)
} else console.log('org exists:', orgId)

// Zones (idempotent par code)
const zones = [
  { name: 'BLEU Centre', code: 'BLEU', color: '#2563EB', flyers: 500 },
  { name: 'VERT Hodimont', code: 'VERT', color: '#16A34A', flyers: 350 },
  { name: 'MALMEDY', code: 'MALM', color: '#0F0F0F', flyers: 400 },
]
const zoneIds = {}
for (const z of zones) {
  let r = await c.query(`select id from public.zones where restaurant_id=$1 and code=$2 limit 1`, [orgId, z.code])
  if (!r.rows[0]) r = await c.query(`insert into public.zones (restaurant_id,name,code,color,flyers_distributed) values ($1,$2,$3,$4,$5) returning id`, [orgId, z.name, z.code, z.color, z.flyers])
  zoneIds[z.code] = r.rows[0].id
}

// Promos
const promos = [
  { name: 'Chimitanga de l’ouest', place: 50, delivery: 55 },
  { name: 'Lili la dinde', place: 20, delivery: 25 },
  { name: 'Mitraillette Max', place: 8, delivery: 10.5 },
  { name: 'Crousty x3', place: 20, delivery: 25 },
  { name: 'Tasty box famillie', place: 30, delivery: 35 },
]
const promoIds = {}
for (const p of promos) {
  let r = await c.query(`select id from public.promos where restaurant_id=$1 and name=$2 limit 1`, [orgId, p.name])
  if (!r.rows[0]) r = await c.query(`insert into public.promos (restaurant_id,name,price_place,price_delivery) values ($1,$2,$3,$4) returning id`, [orgId, p.name, p.place, p.delivery])
  promoIds[p.name] = r.rows[0].id
}

// Sample orders (distinct client_uuid → idempotent-safe)
const existing = await c.query(`select count(*) from public.orders where restaurant_id=$1`, [orgId])
if (Number(existing.rows[0].count) === 0) {
  const sample = [
    { zone: 'BLEU', promo: 'Chimitanga de l’ouest', ch: 'LIVRAISON', amt: 55 },
    { zone: 'BLEU', promo: 'Lili la dinde', ch: 'SUR_PLACE', amt: 20 },
    { zone: 'VERT', promo: 'Crousty x3', ch: 'UBER', amt: 25 },
    { zone: 'MALM', promo: 'Mitraillette Max', ch: 'LIVRAISON', amt: 10.5 },
    { zone: 'BLEU', promo: 'Tasty box famillie', ch: 'SUR_PLACE', amt: 30 },
  ]
  for (const s of sample) {
    await c.query(
      `insert into public.orders (id,restaurant_id,zone_id,promo_id,channel,amount,created_at) values ($1,$2,$3,$4,$5,$6, now() - (interval '1 hour' * floor(random()*24))) on conflict (id) do nothing`,
      [crypto.randomUUID(), orgId, zoneIds[s.zone], promoIds[s.promo], s.ch, s.amt],
    )
  }
  console.log('sample orders seeded:', sample.length)
}

const zc = await c.query(`select count(*) from public.zones where restaurant_id=$1`, [orgId])
const pc = await c.query(`select count(*) from public.promos where restaurant_id=$1`, [orgId])
const oc = await c.query(`select count(*) from public.orders where restaurant_id=$1`, [orgId])
console.log(`DONE — zones=${zc.rows[0].count} promos=${pc.rows[0].count} orders=${oc.rows[0].count}`)
await c.end()
