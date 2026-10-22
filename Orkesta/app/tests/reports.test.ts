import { describe, expect, it } from 'vitest'
import { buildWhatsAppSummary, toCsv } from '../src/lib/reports'
import type { Dashboard } from '../src/lib/admin'

const d: Dashboard = {
  orgName: 'Crousty Verviers',
  distribues: 1450,
  utilises: 1,
  taux: 0,
  caTotal: 55,
  caSurPlace: 0,
  caLivraison: 55,
  byZone: [
    { id: '1', name: 'BLEU Centre', code: 'BLEU', color: '#2563EB', flyersDistributed: 500, used: 1, ca: 55 },
    { id: '2', name: 'VERT Hodimont', code: 'VERT', color: '#16A34A', flyersDistributed: 350, used: 0, ca: 0 },
    { id: '3', name: 'MALMEDY', code: 'MALM', color: '#0F0F0F', flyersDistributed: 400, used: 0, ca: 0 },
  ],
  recent: [],
}

describe('WhatsApp summary (BRIEF §7)', () => {
  const msg = buildWhatsAppSummary(d, 'all')

  it('utilise le nom réel du restaurant (plus de hardcode)', () => {
    expect(msg).toContain('Bilan Crousty Verviers — TOUT:')
    expect(msg).not.toContain('Ahmed')
    expect(msg).not.toContain('CROUSTY OS')
  })

  it('contient les KPI exacts', () => {
    expect(msg).toContain('📦 Distribués: 1450')
    expect(msg).toContain('✅ Utilisés: 1')
    expect(msg).toContain('📈 Taux: 0.0%')
    expect(msg).toContain('💰 CA Total: 55.00€')
    expect(msg).toContain('🍽 Sur Place: 0.00€')
    expect(msg).toContain('🛵 Livraison: 55.00€')
  })

  it('liste Top Zones + attribution', () => {
    expect(msg).toContain('- BLEU Centre: 1 (55.00€)')
    expect(msg).toContain('Généré via Orkesta OS')
  })

  it('change le label de période', () => {
    expect(buildWhatsAppSummary(d, 'today')).toContain("AUJOURD'HUI")
  })
})

describe('CSV', () => {
  it('échappe les virgules et guillemets (Excel FR)', () => {
    const out = toCsv([
      {
        created_at: '2026-10-22T10:00:00Z',
        amount: 12.5,
        channel: 'LIVRAISON',
        client_last4: '4821',
        zones: { name: 'BLEU, Centre' },
        promos: { name: 'Promo "x3"' },
      },
    ])
    const [header, line] = out.split('\n')
    expect(header).toBe('date,zone,promo,canal,montant_eur,client_last4')
    expect(line).toContain('"BLEU, Centre"')
    expect(line).toContain('"Promo ""x3"""')
    expect(line).toContain('12.5,LIVRAISON'.split(',')[0]) // sanity
    expect(line.endsWith('4821')).toBe(true)
  })

  it('gère les valeurs null', () => {
    const out = toCsv([{
      created_at: '2026-10-22T10:00:00Z', amount: 0, channel: 'UBER',
      client_last4: null, zones: null, promos: null,
    }])
    expect(out.split('\n')[1]).toBe('2026-10-22T10:00:00Z,,,UBER,0,')
  })
})
