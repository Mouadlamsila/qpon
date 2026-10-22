import { supabase } from './supabase'
import type { Dashboard } from './admin'
import type { Period } from './types'
import { periodLabel, periodStart } from './period'

// P4 — Reports. 2 niveaux (BRIEF §7).
// Simple : WhatsApp (envoyable au restaurant). CSV : export complet pour Foued.

export type { Period }

const fmt = (n: number) => n.toFixed(2)

export function buildWhatsAppSummary(d: Dashboard, period: Period = 'all'): string {
  const top = d.byZone.slice(0, 3)
  const delta = d.prev && d.prev.caTotal > 0
    ? ((d.caTotal - d.prev.caTotal) / d.prev.caTotal) * 100
    : null
  return [
    `Bilan ${d.orgName} — ${periodLabel(period)}:`,
    `📦 Distribués: ${d.distribues}`,
    `✅ Utilisés: ${d.utilises}`,
    `📈 Taux: ${d.taux.toFixed(1)}%`,
    `💰 CA Total: ${fmt(d.caTotal)}€`,
    `🍽 Sur Place: ${fmt(d.caSurPlace)}€`,
    `🛵 Livraison: ${fmt(d.caLivraison)}€`,
    `💸 Coût campagne: ${fmt(d.cost)}€`,
    `📊 Coût / commande: ${fmt(d.costPerOrder)}€`,
    `📈 ROI: ${d.roi === null ? '—' : `${d.roi.toFixed(1)}%`}`,
    `🧺 Panier moyen: ${fmt(d.panierMoyen)}€`,
    `📅 vs période précédente: ${delta === null ? '—' : `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`}`,
    ``,
    `Top Zones:`,
    ...top.map((z) => `- ${z.name}: ${z.used} (${fmt(z.ca)}€)`),
    ``,
    `Généré via Orkesta OS`,
  ].join('\n')
}

// Ouvre WhatsApp avec le message pré-rempli (wa.me).
export function shareWhatsApp(message: string, phone = ''): void {
  const text = encodeURIComponent(message)
  const url = phone ? `https://wa.me/${phone.replace(/\D/g, '')}?text=${text}` : `https://wa.me/?text=${text}`
  window.open(url, '_blank', 'noopener')
}

interface ExportRow {
  created_at: string
  amount: number
  channel: string
  client_last4: string | null
  zones: { name: string } | null
  promos: { name: string } | null
  organizations: { name: string } | null
}

export function toCsv(rows: ExportRow[]): string {
  const header = ['date', 'restaurant', 'zone', 'promo', 'canal', 'montant_eur', 'client_last4']
  const lines = rows.map((r) => [
    r.created_at,
    csv(r.organizations?.name ?? ''),
    csv(r.zones?.name ?? ''),
    csv(r.promos?.name ?? ''),
    r.channel,
    String(r.amount),
    r.client_last4 ?? '',
  ].join(','))
  return [header.join(','), ...lines].join('\n')
}

// Export CSV de TOUTES les commandes (pagination PostgREST, cap 1000/page).
export async function exportCsv(period: Period = 'all', orgId: string | null = null): Promise<void> {
  if (!supabase) throw new Error('Supabase non configuré')

  const PAGE = 1000
  const rows: ExportRow[] = []
  for (let from = 0; ; from += PAGE) {
    let q = supabase
      .from('orders')
      .select('created_at, amount, channel, client_last4, zones(name), promos(name), organizations(name)')
      .order('created_at', { ascending: false })
      .range(from, from + PAGE - 1)
    if (orgId) q = q.eq('restaurant_id', orgId)
    const start = periodStart(period)
    if (start) q = q.gte('created_at', start.toISOString())

    const { data, error } = await q
    if (error) throw error
    const page = (data ?? []) as unknown as ExportRow[]
    rows.push(...page)
    if (page.length < PAGE) break
  }

  const text = toCsv(rows)
  const blob = new Blob([`\uFEFF${text}`], { type: 'text/csv;charset=utf-8;' }) // BOM = Excel FR
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `orkesta-${period}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

function csv(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}
