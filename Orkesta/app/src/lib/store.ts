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
      // Historique local (pas seulement la queue) : reste visible après sync.
      const all = await db.orders.where('restaurantId').equals(restaurantId).toArray()
      return all.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit)
    },
    [restaurantId, limit],
    [],
  ) as Order[]
}

// Enregistre une commande offline (queue) + historique local.
export async function recordOrder(order: Order): Promise<void> {
  await db.orders.put(order)
  await db.pendingOrders.put({ ...order, status: 'pending' })
  // Historique borné (50/restaurant) pour ne pas gonfler IndexedDB.
  const all = await db.orders.where('restaurantId').equals(order.restaurantId).toArray()
  if (all.length > 50) {
    all.sort((a, b) => a.createdAt - b.createdAt)
    await db.orders.bulkDelete(all.slice(0, all.length - 50).map((o) => o.id))
  }
}
