import { supabase } from './supabase'
import type { Dashboard } from './admin'

// P4 — Reports. 2 niveaux (BRIEF §7).
// Simple : WhatsApp (envoyable au restaurant). CSV : export complet pour Foued.

export type Period = 'all' | 'today'

export function periodLabel(p: Period): string {
  return p === 'today' ? "AUJOURD'HUI" : 'TOUT'
}

// Début de journée locale → ISO (filtre serveur).
export function startOfTodayIso(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export function buildWhatsAppSummary(d: Dashboard, period: Period = 'all'): string {
  const top = d.byZone.slice(0, 3)
  return [
    `Bilan ${d.orgName} — ${periodLabel(period)}:`,
    `📦 Distribués: ${d.distribues}`,
    `✅ Utilisés: ${d.utilises}`,
    `📈 Taux: ${d.taux.toFixed(1)}%`,
    `💰 CA Total: ${d.caTotal.toFixed(2)}€`,
    `🍽 Sur Place: ${d.caSurPlace.toFixed(2)}€`,
    `🛵 Livraison: ${d.caLivraison.toFixed(2)}€`,
    ``,
    `Top Zones:`,
    ...top.map((z) => `- ${z.name}: ${z.used} (${z.ca.toFixed(2)}€)`),
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
}

export function toCsv(rows: ExportRow[]): string {
  const header = ['date', 'zone', 'promo', 'canal', 'montant_eur', 'client_last4']
  const lines = rows.map((r) => [
    r.created_at,
    csv(r.zones?.name ?? ''),
    csv(r.promos?.name ?? ''),
    r.channel,
    String(r.amount),
    r.client_last4 ?? '',
  ].join(','))
  return [header.join(','), ...lines].join('\n')
}

// Export CSV de TOUTES les commandes (pagination PostgREST, cap 1000/page).
export async function exportCsv(period: Period = 'all'): Promise<void> {
  if (!supabase) throw new Error('Supabase non configuré')

  const PAGE = 1000
  const rows: ExportRow[] = []
  for (let from = 0; ; from += PAGE) {
    let q = supabase
      .from('orders')
      .select('created_at, amount, channel, client_last4, zones(name), promos(name)')
      .order('created_at', { ascending: false })
      .range(from, from + PAGE - 1)
    if (period === 'today') q = q.gte('created_at', startOfTodayIso())

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
