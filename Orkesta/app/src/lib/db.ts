import Dexie, { type EntityTable } from 'dexie'
import type { Order, Organization, Promo, Zone } from './types'

// Offline-first. Le serveur reste source of truth ; Dexie = cache + file d'attente.
// pendingOrders = queue de sync avec client_uuid idempotent.
interface PendingOrder extends Order {
  status: 'pending' | 'synced' | 'error'
  lastError?: string
}

const db = new Dexie('orkesta') as Dexie & {
  orgs: EntityTable<Organization, 'id'>
  zones: EntityTable<Zone, 'id'>
  promos: EntityTable<Promo, 'id'>
  pendingOrders: EntityTable<PendingOrder, 'id'>
}

db.version(1).stores({
  orgs: 'id, name',
  // index restaurantId = isolation tenant côté local
  zones: 'id, restaurantId',
  promos: 'id, restaurantId',
  // client_uuid (id) = clé d'idempotency. status = filtre de sync.
  pendingOrders: 'id, status, restaurantId',
})

// P6 — Révocation tablette : "collaboration stoppée → tablette vidée" (BRIEF §8).
// Vide TOUT le cache local (orgs/zones/promos/orders). Le serveur reste source of truth.
export async function wipeLocal(): Promise<void> {
  await db.delete()
  await db.open() // recrée le schéma : sinon les requêtes suivantes échouent (DB fermée)
}

export { db }
export type { PendingOrder }
