import { db } from './db'
import { ZONE_COLORS } from './constants'

// Données d'exemple — 100% modifiables (BRIEF §10). Jamais figées dans le code.
// Seed une seule fois au premier lancement (offline).
export async function seedIfEmpty(): Promise<void> {
  if ((await db.orgs.count()) > 0) return

  const orgId = crypto.randomUUID()
  await db.orgs.add({ id: orgId, name: 'Crousty Verviers', createdAt: Date.now() })

  await db.zones.bulkAdd([
    { id: crypto.randomUUID(), restaurantId: orgId, name: 'BLEU Centre', code: 'BLEU', color: ZONE_COLORS.blue, flyersDistributed: 500 },
    { id: crypto.randomUUID(), restaurantId: orgId, name: 'VERT Hodimont', code: 'VERT', color: ZONE_COLORS.green, flyersDistributed: 350 },
    { id: crypto.randomUUID(), restaurantId: orgId, name: 'MALMEDY', code: 'MALM', color: ZONE_COLORS.black, flyersDistributed: 400 },
  ])

  await db.promos.bulkAdd([
    { id: crypto.randomUUID(), restaurantId: orgId, name: 'Chimitanga de l’ouest', pricePlace: 50, priceDelivery: 55, active: true },
    { id: crypto.randomUUID(), restaurantId: orgId, name: 'Lili la dinde', pricePlace: 20, priceDelivery: 25, active: true },
    { id: crypto.randomUUID(), restaurantId: orgId, name: 'Mitraillette Max', pricePlace: 8, priceDelivery: 10.5, active: true },
    { id: crypto.randomUUID(), restaurantId: orgId, name: 'Crousty x3', pricePlace: 20, priceDelivery: 25, active: true },
    { id: crypto.randomUUID(), restaurantId: orgId, name: 'Tasty box famillie', pricePlace: 30, priceDelivery: 35, active: true },
  ])
}
