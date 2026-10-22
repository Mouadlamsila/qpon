import { describe, expect, it } from 'vitest'
import { periodLabel, periodStart, previousRange } from '../src/lib/period'

describe('périodes dashboard', () => {
  it('labels', () => {
    expect(periodLabel('today')).toBe("AUJOURD'HUI")
    expect(periodLabel('week')).toBe('CETTE SEMAINE')
    expect(periodLabel('month')).toBe('CE MOIS')
    expect(periodLabel('all')).toBe('TOUT')
  })

  it('today : fenêtre précédente = la veille', () => {
    const r = previousRange('today')!
    expect(r.end.getTime()).toBe(periodStart('today')!.getTime())
    expect(Math.round((r.end.getTime() - r.start.getTime()) / 86_400_000)).toBe(1)
  })

  it('semaine : commence un lundi, fenêtre précédente = 7 jours', () => {
    expect(periodStart('week')!.getDay()).toBe(1)
    const r = previousRange('week')!
    expect(Math.round((r.end.getTime() - r.start.getTime()) / 86_400_000)).toBe(7)
    expect(r.end.getTime()).toBe(periodStart('week')!.getTime())
  })

  it('mois : commence le 1er, fenêtre précédente = mois précédent', () => {
    const s = periodStart('month')!
    expect(s.getDate()).toBe(1)
    const r = previousRange('month')!
    expect(r.end.getTime()).toBe(s.getTime())
    expect(r.start.getMonth()).toBe((s.getMonth() + 11) % 12)
  })

  it('all : pas de filtre ni de comparaison', () => {
    expect(periodStart('all')).toBeNull()
    expect(previousRange('all')).toBeNull()
  })
})
