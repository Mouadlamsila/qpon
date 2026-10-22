import type { Period } from './types'

// Début de période (heure locale). null = tout l'historique.
export function periodStart(p: Period): Date | null {
  const d = new Date()
  if (p === 'today') { d.setHours(0, 0, 0, 0); return d }
  if (p === 'week') {
    const day = (d.getDay() + 6) % 7 // lundi = 0
    d.setDate(d.getDate() - day)
    d.setHours(0, 0, 0, 0)
    return d
  }
  if (p === 'month') { d.setDate(1); d.setHours(0, 0, 0, 0); return d }
  return null
}

// Fenêtre précédente de même durée (comparaison BRIEF §6).
export function previousRange(p: Period): { start: Date; end: Date } | null {
  const end = periodStart(p)
  if (!end) return null
  const start = new Date(end)
  if (p === 'today') start.setDate(start.getDate() - 1)
  if (p === 'week') start.setDate(start.getDate() - 7)
  if (p === 'month') start.setMonth(start.getMonth() - 1)
  return { start, end }
}

export function periodLabel(p: Period): string {
  switch (p) {
    case 'today': return "AUJOURD'HUI"
    case 'week': return 'CETTE SEMAINE'
    case 'month': return 'CE MOIS'
    default: return 'TOUT'
  }
}
