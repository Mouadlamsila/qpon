// Orkesta domain types — alignées sur PLAN_TECHNIQUE §4

export type Channel =
  | 'SUR_PLACE'
  | 'LIVRAISON'
  | 'UBER'
  | 'TAKEAWAY'
  | 'APPLI'

export type UserRole = 'admin_foued' | 'server_restaurant'

// Périodes dashboard admin (BRIEF §5.2).
export type Period = 'all' | 'today' | 'week' | 'month'

export interface Organization {
  id: string
  name: string
  createdAt: number
}

export interface Zone {
  id: string
  restaurantId: string
  name: string // "BLEU Centre"
  code: string // "BLEU"
  color: string // "#2563EB"
  flyersDistributed: number // 500
}

export interface Promo {
  id: string
  restaurantId: string
  name: string // "Chimitanga de l'ouest"
  pricePlace: number
  priceDelivery: number
  active: boolean
}

export interface Order {
  id: string // client_uuid (idempotency key)
  restaurantId: string
  zoneId: string
  promoId: string
  channel: Channel
  amount: number
  clientLast4?: string | null // RGPD, optionnel
  createdAt: number
  syncedAt?: number | null
}

export interface Campaign {
  id: string
  restaurantId: string
  name: string
  cost: number
  startDate: number
  endDate?: number | null
}
