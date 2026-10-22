import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock supabase avant import sync.ts (sync importe ./supabase).
const ordersUpsert = vi.fn().mockResolvedValue({ error: null })
const zonesUpsert = vi.fn().mockResolvedValue({ error: null })
const promosUpsert = vi.fn().mockResolvedValue({ error: null })
const selectOrgs = vi.fn().mockResolvedValue({ data: [] })
const selectZones = vi.fn().mockResolvedValue({ data: [] })
const selectPromos = vi.fn().mockResolvedValue({ data: [] })
const getUser = vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } })

vi.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: { getUser },
    from: (t: string) => ({
      orders: { upsert: ordersUpsert },
      organizations: { select: selectOrgs },
      zones: { select: selectZones, upsert: zonesUpsert },
      promos: { select: selectPromos, upsert: promosUpsert },
    })[t],
  },
  isSupabaseConfigured: true,
}))

const { db } = await import('../src/lib/db')
const { pushOrders, pushReference } = await import('../src/lib/sync')

const order = (id: string) => ({
  id, restaurantId: 'r1', zoneId: 'z1', promoId: 'p1',
  channel: 'UBER' as const, amount: 25, createdAt: Date.now(), status: 'pending' as const,
})

beforeEach(async () => {
  await db.zones.clear()
  await db.promos.clear()
  await db.orgs.clear()
  await db.pendingOrders.clear()
  for (const fn of [ordersUpsert, zonesUpsert, promosUpsert]) {
    fn.mockClear()
    fn.mockResolvedValue({ error: null })
  }
  selectOrgs.mockResolvedValue({ data: [] })
  selectZones.mockResolvedValue({ data: [] })
  selectPromos.mockResolvedValue({ data: [] })
  getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
})

describe('Dexie offline queue', () => {
  it('records an order as pending', async () => {
    await db.pendingOrders.put(order(crypto.randomUUID()))
    expect(await db.pendingOrders.where('status').equals('pending').count()).toBe(1)
  })

  it('push sends pending rows with client_uuid, then drains queue', async () => {
    const id = crypto.randomUUID()
    await db.pendingOrders.put(order(id))

    const n = await pushOrders()
    expect(n).toBe(1)
    // upsert appelé avec id = client_uuid (idempotency key)
    expect(ordersUpsert).toHaveBeenCalledTimes(1)
    const [row, opts] = ordersUpsert.mock.calls[0]
    expect(row.id).toBe(id)
    expect(opts).toEqual({ onConflict: 'id', ignoreDuplicates: true })
    // queue drainée
    expect(await db.pendingOrders.where('status').equals('pending').count()).toBe(0)
  })

  it('no pending → push does nothing (no supabase call)', async () => {
    const n = await pushOrders()
    expect(n).toBe(0)
    expect(ordersUpsert).not.toHaveBeenCalled()
  })

  it('une commande invalide ne bloque pas les autres (row par row)', async () => {
    const good = crypto.randomUUID()
    await db.pendingOrders.bulkPut([order(crypto.randomUUID()), order(good)])
    ordersUpsert.mockResolvedValueOnce({ error: { message: 'FK zone' } })

    const n = await pushOrders()
    expect(n).toBe(1)
    expect(await db.pendingOrders.where('status').equals('error').count()).toBe(1)
    expect(await db.pendingOrders.where('status').equals('pending').count()).toBe(0)
  })
})

describe('pushReference (zones/promos créés offline)', () => {
  const zone = (id: string, restaurantId: string) => ({
    id, restaurantId, name: 'TEST', code: 'TEST', color: '#000', flyersDistributed: 10,
  })

  it('pousse seulement les rows absentes du serveur, et seulement pour un tenant connu', async () => {
    selectOrgs.mockResolvedValue({ data: [{ id: 'r1' }] })
    selectZones.mockResolvedValue({ data: [{ id: 'z-server' }] })
    await db.zones.bulkPut([
      zone('z-server', 'r1'), // déjà sur le serveur → ne pas réécrire
      zone('z-new', 'r1'), // local-only, tenant connu → push
      zone('z-orphan', 'r-fake'), // seed local, tenant inconnu → skip (FK)
    ])

    await pushReference()

    expect(zonesUpsert).toHaveBeenCalledTimes(1)
    const rows = zonesUpsert.mock.calls[0][0]
    expect(rows.map((r: { id: string }) => r.id)).toEqual(['z-new'])
    expect(zonesUpsert.mock.calls[0][1]).toEqual({ onConflict: 'id', ignoreDuplicates: true })
  })

  it('aucun tenant connu → ne pousse rien', async () => {
    await db.zones.put(zone('z1', 'r1'))
    await pushReference()
    expect(zonesUpsert).not.toHaveBeenCalled()
  })
})
