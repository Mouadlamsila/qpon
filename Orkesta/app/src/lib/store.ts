import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import type { Order, Organization, Promo, Zone } from './types'

// Live queries — les cards se mettent à jour en temps réel depuis Dexie.
export function useOrgs(): Organization[] {
  return useLiveQuery(() => db.orgs.toArray(), [], []) as Organization[]
}

export function useZones(restaurantId: string | null): Zone[] {
  return useLiveQuery(
    async () => (restaurantId ? db.zones.where('restaurantId').equals(restaurantId).toArray() : []),
    [restaurantId],
    [],
  ) as Zone[]
}

export function usePromos(restaurantId: string | null): Promo[] {
  return useLiveQuery(
    async () => (restaurantId ? db.promos.where('restaurantId').equals(restaurantId).toArray() : []),
    [restaurantId],
    [],
  ) as Promo[]
}

export function useRecentOrders(restaurantId: string | null, limit = 8): Order[] {
  return useLiveQuery(
    async () => {
      if (!restaurantId) return []
      const all = await db.pendingOrders.where('restaurantId').equals(restaurantId).reverse().toArray()
      return all.slice(0, limit)
    },
    [restaurantId, limit],
    [],
  ) as Order[]
}

// Enregistre une commande offline (queue). client_uuid = idempotency.
export async function recordOrder(order: Order): Promise<void> {
  await db.pendingOrders.put({ ...order, status: 'pending' })
}
