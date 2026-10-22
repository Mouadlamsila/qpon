import type { Channel } from './types'

// 5 canaux — BRIEF §4.4. Le serveur tap = select.
export const CHANNELS: { id: Channel; label: string }[] = [
  { id: 'SUR_PLACE', label: 'Sur place' },
  { id: 'LIVRAISON', label: 'Livraison' },
  { id: 'UBER', label: 'Uber' },
  { id: 'TAKEAWAY', label: 'Takeaway' },
  { id: 'APPLI', label: 'Appli' },
]

// Couleurs zones par défaut (repères visuels, jamais figés en DB)
export const ZONE_COLORS = {
  blue: '#2563EB',
  green: '#16A34A',
  black: '#0F0F0F',
  orange: '#F97316',
} as const

// Palette V5 (reproduire à l'identique)
export const THEME = {
  cream: '#FEF9EC',
  ink: '#111111',
  flame: '#FF4D00',
  mute: '#E5E7EB',
  wa: '#22C55E',
} as const

// PIN Admin = UX only. La vraie sécurité = Supabase Auth + RLS.
export const ADMIN_PIN = '2026'
