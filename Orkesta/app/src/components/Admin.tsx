import { useEffect, useState } from 'react'
import {
  addCampaignCost, addRestaurant, isAdmin, loadDashboard, setPromoActive, setZoneFlyers,
  signIn, signOut, type Dashboard,
} from '../lib/admin'
import { buildWhatsAppSummary, exportCsv, shareWhatsApp } from '../lib/reports'
import { periodLabel } from '../lib/period'
import type { Period } from '../lib/types'
import { supabase } from '../lib/supabase'
import { db } from '../lib/db'
import { navigate } from '../lib/router'
import DebugPanel from './DebugPanel'
import ZoneQR from './ZoneQR'
import Modal from './Modal'

// Mode Admin — PIN 2026 (UX) + Supabase Auth (vraie sécurité) + dashboard.
// Filtre restaurant + période (BRIEF §5.2), KPI complets, promo/clients (BRIEF §5.6-5.7).
export default function Admin() {
  const [unlocked, setUnlocked] = useState(false)
  const [authed, setAuthed] = useState(false)
  const [checking, setChecking] = useState(true)
  const [dash, setDash] = useState<Dashboard | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [period, setPeriod] = useState<Period>('all')
  const [orgId, setOrgId] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)
  const [showWa, setShowWa] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [cost, setCost] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  function flash(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  // Lock = sign-out → wipeLocal (SIGNED_OUT). Garde : ne jamais perdre des
  // commandes pas encore arrivées au serveur sans confirmation.
  async function lock() {
    const pending = await db.pendingOrders.where('status').equals('pending').count()
    if (pending > 0 && !window.confirm(`${pending} commande(s) pas encore synchronisée(s). Verrouiller quand même ?`)) return
    void signOut()
    setAuthed(false)
    setUnlocked(false)
    navigate('/')
  }

  // Vérifie session existante au mount.
  useEffect(() => {
    if (!supabase) { setChecking(false); return }
    isAdmin()
      .then((v) => { setAuthed(v); setUnlocked(v); setChecking(false) })
      .catch(() => setChecking(false))
  }, [])

  // Charge le dashboard + auto-refresh 30s (temps réel léger, RLS respectée).
  useEffect(() => {
    if (!authed) return
    let alive = true
    let busy = false
    const load = async () => {
      if (busy) return
      busy = true
      try {
        const d = await loadDashboard(period, orgId)
        if (alive) { setDash(d); setErr(null) }
      } catch (e) {
        if (alive) setErr((e as Error).message)
      } finally {
        busy = false
      }
    }
    void load()
    const id = setInterval(() => void load(), 30_000)
    const onVis = () => { if (document.visibilityState === 'visible') void load() }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      alive = false
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [authed, period, orgId, nonce])

  async function saveCost() {
    if (!orgId) return
    const n = Number(cost)
    if (!Number.isFinite(n) || n <= 0) return
    try {
      await addCampaignCost(orgId, n)
      setCost('')
      flash('Coût campagne ajouté')
      setNonce((x) => x + 1)
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  async function togglePromo(id: string, active: boolean) {
    try {
      await setPromoActive(id, active)
      setNonce((x) => x + 1)
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  async function changeFlyers(id: string, flyers: number) {
    try {
      await setZoneFlyers(id, flyers)
      flash('Flyers mis à jour')
      setNonce((x) => x + 1)
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  if (checking) return <Pad className="text-ink/40">Chargement…</Pad>
  if (!supabase) return <Pad className="text-ink/60">Supabase non configuré (remplir .env)</Pad>

  if (!unlocked) return <Pad><PinGate onUnlock={() => setUnlocked(true)} /></Pad>
  if (!authed) return <Pad><Login onDone={() => { setAuthed(true); navigate('/admin') }} /></Pad>

  return (
    <main className="min-h-dvh bg-cream text-ink">
      <div className="page-width space-y-5 px-4 py-5">
        {/* Top Header + Quick Actions */}
        <div className="flex flex-col gap-3 rounded-[28px] border border-ink/10 bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold tracking-tight text-ink">Dashboard Foued</h1>
                <span className="rounded-full bg-flame/10 px-2.5 py-0.5 text-[11px] font-bold text-flame">
                  {periodLabel(period)}
                </span>
              </div>
              <p className="mt-0.5 text-xs font-medium text-ink/50">
                {dash ? `${dash.orgName} · Performance temps réel` : 'Chargement des données…'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowAdd(true)}
                className="tap rounded-full bg-ink px-3.5 py-1.5 text-xs font-bold text-white"
              >
                + Restaurant
              </button>
              <button
                type="button"
                disabled={!dash}
                onClick={() => void exportCsv(period, orgId).catch((e) => setErr((e as Error).message))}
                className="tap rounded-full border border-ink/15 bg-white px-3 py-1.5 text-xs font-bold text-ink/80 disabled:opacity-40"
              >
                Export CSV
              </button>
              <button
                type="button"
                disabled={!dash}
                onClick={() => setShowWa(true)}
                className="tap rounded-full bg-wa px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
              >
                WhatsApp
              </button>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="tap rounded-full border border-ink/15 bg-white px-3 py-1.5 text-xs font-bold text-ink/70"
              >
                Caisse
              </button>
              <button
                type="button"
                onClick={() => void lock()}
                className="tap rounded-full border border-flame/25 bg-flame/5 px-3 py-1.5 text-xs font-bold text-flame"
              >
                Lock
              </button>
            </div>
          </div>

          {/* Filter Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink/10 pt-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wide text-ink/40">Client</span>
              <select
                value={orgId ?? ''}
                onChange={(e) => setOrgId(e.target.value || null)}
                className="max-w-52 rounded-full border border-ink/15 bg-cream/60 px-3.5 py-1.5 text-xs font-bold text-ink focus:border-ink focus:outline-none"
              >
                <option value="" className="text-ink">Tous clients</option>
                {(dash?.orgs ?? []).map((o) => (
                  <option key={o.id} value={o.id} className="text-ink">{o.name}</option>
                ))}
              </select>
            </div>

            <div className="flex overflow-hidden rounded-full border border-ink/15 bg-cream/50 p-0.5 text-[11px] font-bold">
              {(['today', 'week', 'month', 'all'] as Period[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={`rounded-full px-3 py-1 transition-colors ${
                    period === p ? 'bg-flame text-white' : 'text-ink/60 hover:text-ink'
                  }`}
                >
                  {shortPeriod(p)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {err && <p className="rounded-2xl bg-flame/15 p-3 text-sm font-semibold text-flame">{err}</p>}

        {!dash ? (
          <p className="py-16 text-center text-sm text-ink/40">Chargement stats…</p>
        ) : (
          <Stats
            d={dash}
            cost={cost}
            onCost={setCost}
            onSaveCost={() => void saveCost()}
            onSelectOrg={(id) => setOrgId(id)}
            onTogglePromo={(id, active) => void togglePromo(id, active)}
            onFlyers={(id, n) => void changeFlyers(id, n)}
          />
        )}

        {/* Dev only — replié par défaut pour ne pas encombrer */}
        {import.meta.env.DEV && (
          <details className="rounded-[28px] border border-ink/10 bg-white/70 px-4 py-3">
            <summary className="cursor-pointer select-none text-xs font-bold uppercase tracking-wide text-ink/50">
              Diagnostic développeur
            </summary>
            <div className="mt-3">
              <DebugPanel />
            </div>
          </details>
        )}
      </div>

      {showWa && dash && <WaModal d={dash} period={period} onClose={() => setShowWa(false)} />}
      {showAdd && (
        <AddRestaurantModal
          onClose={() => setShowAdd(false)}
          onDone={() => { setShowAdd(false); setNonce((x) => x + 1); flash('Restaurant ajouté') }}
        />
      )}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center">
          <p className="rounded-full bg-ink px-4 py-2 text-sm font-bold text-white shadow-lg">{toast}</p>
        </div>
      )}
    </main>
  )
}

function Stats({
  d, cost, onCost, onSaveCost, onSelectOrg, onTogglePromo, onFlyers,
}: {
  d: Dashboard
  cost: string
  onCost: (v: string) => void
  onSaveCost: () => void
  onSelectOrg: (id: string) => void
  onTogglePromo: (id: string, active: boolean) => void
  onFlyers: (id: string, n: number) => void
}) {
  const delta = d.prev && d.prev.caTotal > 0
    ? ((d.caTotal - d.prev.caTotal) / d.prev.caTotal) * 100
    : null

  const channels = [
    { label: 'Sur place', value: d.caSurPlace },
    { label: 'Livraison', value: d.caLivraison },
    { label: 'Takeaway', value: d.caTakeaway },
    { label: 'Uber', value: d.caUber },
    { label: 'Appli', value: d.caAppli },
  ]

  const maxZoneCa = Math.max(1, ...d.byZone.map((z) => z.ca))

  return (
    <div className="space-y-4">
      {/* 1. Hero KPIs (4 cartes hiérarchisées) */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* CA Total */}
        <div className="rounded-[28px] bg-flame p-5 text-white">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-white/75">CA Total</p>
            {delta !== null && (
              <span className="rounded-full bg-white/20 px-2 py-0.5 font-mono text-[10px] font-bold text-white">
                {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%
              </span>
            )}
          </div>
          <p className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
            {d.caTotal.toFixed(2)}€
          </p>
          <p className="mt-1 text-[11px] font-medium text-white/75">
            {delta === null ? 'Toutes périodes confondues' : 'vs période précédente'}
          </p>
        </div>

        {/* Coupons utilisés / distribués */}
        <div className="rounded-[28px] border border-ink/10 bg-white p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink/50">Coupons utilisés</p>
            <span className="rounded-full bg-cream px-2 py-0.5 font-mono text-[10px] font-bold text-ink">
              {d.taux.toFixed(1)}%
            </span>
          </div>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
            {d.utilises}
          </p>
          <p className="mt-1 text-[11px] font-medium text-ink/50">
            sur {d.distribues} flyers posés
          </p>
        </div>

        {/* Panier moyen */}
        <div className="rounded-[28px] border border-ink/10 bg-white p-5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-ink/50">Panier moyen</p>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
            {d.panierMoyen.toFixed(2)}€
          </p>
          <p className="mt-1 text-[11px] font-medium text-ink/50">
            Moyenne par commande
          </p>
        </div>

        {/* ROI */}
        <div className="rounded-[28px] border border-ink/10 bg-white p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink/50">ROI Campagne</p>
            {d.roi !== null && (
              <span
                className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ${
                  d.roi >= 0 ? 'bg-wa/15 text-wa' : 'bg-flame/15 text-flame'
                }`}
              >
                {d.roi >= 0 ? 'Rentable' : 'Déficit'}
              </span>
            )}
          </div>
          <p
            className={`mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl ${
              d.roi === null ? 'text-ink/40' : d.roi >= 0 ? 'text-wa' : 'text-flame'
            }`}
          >
            {d.roi === null ? '—' : `${d.roi.toFixed(1)}%`}
          </p>
          <p className="mt-1 text-[11px] font-medium text-ink/50">
            Coût {d.cost.toFixed(0)}€ · {d.costPerOrder.toFixed(2)}€/cmd
          </p>
        </div>
      </div>

      {/* 2. Canaux de vente + Budget campagne (2 colonnes) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Canaux */}
        <section className="rounded-[28px] border border-ink/10 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-extrabold text-ink">Canaux de vente</h2>
              <p className="text-xs text-ink/45">Répartition du chiffre d'affaires</p>
            </div>
            <span className="font-mono text-xs font-bold text-ink/50">{d.caTotal.toFixed(2)}€</span>
          </div>
          <div className="space-y-3">
            {channels.map((c) => {
              const pct = d.caTotal > 0 ? (c.value / d.caTotal) * 100 : 0
              return (
                <div key={c.label}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-bold text-ink">{c.label}</span>
                    <span className="font-mono text-ink/70">
                      <span className="font-bold text-ink">{c.value.toFixed(2)}€</span>
                      <span className="ml-1.5 text-[10px] text-ink/45">({pct.toFixed(0)}%)</span>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-cream">
                    <div
                      className="h-full rounded-full bg-flame transition-all"
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Budget & Rentabilité */}
        <section className="flex flex-col justify-between rounded-[28px] border border-ink/10 bg-white p-5">
          <div>
            <h2 className="text-sm font-extrabold text-ink">Budget &amp; Rentabilité</h2>
            <p className="mb-4 text-xs text-ink/45">Suivi des dépenses d'acquisition</p>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-2xl bg-cream/60 p-3">
                <p className="text-[10px] font-bold uppercase text-ink/50">Coût total</p>
                <p className="mt-1 font-mono text-base font-extrabold text-ink">{d.cost.toFixed(2)}€</p>
              </div>
              <div className="rounded-2xl bg-cream/60 p-3">
                <p className="text-[10px] font-bold uppercase text-ink/50">Coût / cmd</p>
                <p className="mt-1 font-mono text-base font-extrabold text-ink">{d.costPerOrder.toFixed(2)}€</p>
              </div>
              <div className="rounded-2xl bg-cream/60 p-3">
                <p className="text-[10px] font-bold uppercase text-ink/50">Net généré</p>
                <p className="mt-1 font-mono text-base font-extrabold text-ink">
                  {(d.caTotal - d.cost).toFixed(0)}€
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 border-t border-ink/10 pt-4">
            {d.orgId ? (
              <div className="flex gap-2">
                <input
                  value={cost}
                  onChange={(e) => onCost(e.target.value.replace(/[^\d.]/g, ''))}
                  placeholder="Ajouter un coût campagne € (ex: 250)"
                  inputMode="decimal"
                  className="min-w-0 flex-1 rounded-2xl border border-ink/15 bg-cream/40 px-3.5 py-2.5 text-sm font-semibold text-ink placeholder:text-ink/35 focus:border-ink focus:bg-white focus:outline-none"
                />
                <button
                  type="button"
                  onClick={onSaveCost}
                  className="tap shrink-0 rounded-2xl bg-flame px-4 py-2.5 text-xs font-bold text-white"
                >
                  + Ajouter
                </button>
              </div>
            ) : (
              <p className="rounded-2xl bg-cream/60 px-3.5 py-2.5 text-xs font-medium text-ink/55">
                Sélectionne un restaurant dans le filtre client pour saisir un coût campagne.
              </p>
            )}
          </div>
        </section>
      </div>

      {/* 3. Zones & Promos (2 colonnes) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Table par zone */}
        <section className="rounded-[28px] border border-ink/10 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-extrabold text-ink">Performance par zone</h2>
              <p className="text-xs text-ink/45">Modifie le nombre de flyers posés directement</p>
            </div>
            <span className="rounded-full bg-cream px-2.5 py-1 text-[11px] font-bold text-ink/60">
              {d.byZone.length}
            </span>
          </div>

          {d.byZone.length === 0 ? (
            <p className="py-6 text-center text-xs text-ink/40">Aucune zone</p>
          ) : (
            <div className="divide-y divide-ink/5">
              {d.byZone.map((z) => (
                <div key={z.id} className="py-3 first:pt-1 last:pb-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: z.color }} />
                    <span className="min-w-0 flex-1 truncate font-bold text-ink">{z.name}</span>
                    <span className="flex shrink-0 items-center gap-1 text-[11px] text-ink/45">
                      <input
                        key={z.flyersDistributed}
                        type="number"
                        defaultValue={z.flyersDistributed}
                        onBlur={(e) => {
                          if (e.target.value === '') { e.target.value = String(z.flyersDistributed); return }
                          const n = Number(e.target.value)
                          if (Number.isFinite(n) && n !== z.flyersDistributed) onFlyers(z.id, n)
                        }}
                        className="w-16 rounded-lg border border-ink/15 bg-cream/40 px-1.5 py-0.5 text-right font-mono text-xs font-bold text-ink focus:border-ink focus:bg-white focus:outline-none"
                        aria-label={`Flyers distribués ${z.name}`}
                      />
                      posés
                    </span>
                    <span className="shrink-0 text-xs font-medium text-ink/60">{z.used} util.</span>
                    <span className="shrink-0 rounded-full bg-cream px-2 py-0.5 font-mono text-[11px] font-bold text-ink/70">
                      {z.taux.toFixed(1)}%
                    </span>
                    <span className="w-14 shrink-0 text-right font-mono text-xs font-extrabold text-flame">
                      {z.ca.toFixed(0)}€
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-cream">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (z.ca / maxZoneCa) * 100)}%`,
                        backgroundColor: z.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Table par promo */}
        <section className="rounded-[28px] border border-ink/10 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-extrabold text-ink">Performance par promo</h2>
              <p className="text-xs text-ink/45">Tarifs sur place / livraison et statut</p>
            </div>
            <span className="rounded-full bg-cream px-2.5 py-1 text-[11px] font-bold text-ink/60">
              {d.byPromo.length}
            </span>
          </div>

          {d.byPromo.length === 0 ? (
            <p className="py-6 text-center text-xs text-ink/40">Aucune promo</p>
          ) : (
            <div className="divide-y divide-ink/5">
              {d.byPromo.map((p) => (
                <div key={p.id} className="flex items-center gap-2.5 py-2.5 first:pt-1 last:pb-1 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate font-bold ${p.active ? 'text-ink' : 'text-ink/40 line-through'}`}>
                      {p.name}
                    </span>
                    <span className="block font-mono text-[11px] text-ink/45">
                      {p.pricePlace}€ place · {p.priceDelivery}€ livr.
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-medium text-ink/60">{p.used} util.</span>
                  <span className="w-14 shrink-0 text-right font-mono text-xs font-extrabold text-flame">
                    {p.ca.toFixed(0)}€
                  </span>
                  <button
                    type="button"
                    onClick={() => onTogglePromo(p.id, !p.active)}
                    className={`tap shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${
                      p.active
                        ? 'bg-cream text-ink/70 hover:bg-ink/10'
                        : 'bg-wa/15 text-wa hover:bg-wa/25'
                    }`}
                  >
                    {p.active ? 'Désactiver' : 'Activer'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* 4. Clients — Classement rentabilité */}
      {d.orgId === null && d.byOrg.length > 0 && (
        <section className="rounded-[28px] border border-ink/10 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-extrabold text-ink">Clients — Classement rentabilité</h2>
              <p className="text-xs text-ink/45">Clique sur un restaurant pour filtrer le dashboard</p>
            </div>
            <span className="rounded-full bg-cream px-2.5 py-1 text-[11px] font-bold text-ink/60">
              {d.byOrg.length} restaurant{d.byOrg.length > 1 ? 's' : ''}
            </span>
          </div>

          <div className="divide-y divide-ink/5">
            {d.byOrg.map((o, i) => (
              <div key={o.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-1 last:pb-1 text-sm">
                <span
                  className={`grid size-7 shrink-0 place-items-center rounded-full font-mono text-xs font-extrabold ${
                    i === 0 ? 'bg-flame text-white' : 'bg-cream text-ink/60'
                  }`}
                >
                  #{i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => onSelectOrg(o.id)}
                  className="min-w-0 flex-1 truncate text-left font-bold text-ink hover:text-flame"
                >
                  {o.name}
                </button>
                <span className="shrink-0 text-xs font-medium text-ink/60">{o.orders} cmd</span>
                <span className="hidden shrink-0 font-mono text-xs text-ink/50 sm:inline">
                  panier {o.panierMoyen.toFixed(1)}€
                </span>
                <span className="w-16 shrink-0 text-right font-mono text-xs font-extrabold text-flame">
                  {o.ca.toFixed(0)}€
                </span>
                <span
                  className={`w-16 shrink-0 rounded-full px-2 py-0.5 text-center font-mono text-[11px] font-bold ${
                    o.roi === null
                      ? 'bg-cream text-ink/35'
                      : o.roi >= 0
                        ? 'bg-wa/15 text-wa'
                        : 'bg-flame/15 text-flame'
                  }`}
                >
                  {o.roi === null ? '—' : `${o.roi.toFixed(0)}%`}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 5. Dernières commandes */}
      <section className="rounded-[28px] border border-ink/10 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-extrabold text-ink">Dernières commandes</h2>
            <p className="text-xs text-ink/45">10 dernières validations enregistrées</p>
          </div>
          <span className="rounded-full bg-cream px-2.5 py-1 text-[11px] font-bold text-ink/60">
            {d.recent.length}
          </span>
        </div>

        {d.recent.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-ink/15 p-6 text-center text-xs text-ink/40">
            Aucune commande sur cette période
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {d.recent.map((o) => (
              <li
                key={o.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-cream/35 px-3.5 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 font-mono text-[11px] font-bold text-ink/45">
                      {time(o.createdAt)}
                    </span>
                    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: o.zoneColor }} />
                    <span className="truncate text-sm font-bold text-ink">{o.promoName}</span>
                  </div>
                  <p className="mt-0.5 truncate pl-11 text-[11px] text-ink/50">
                    {o.orgName} · {o.zoneName} ·{' '}
                    <span className="font-semibold text-ink/70">{o.channel}</span>
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-white px-2.5 py-1 font-mono text-xs font-extrabold text-ink shadow-2xs">
                  {o.amount}€
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 6. QR par zone */}
      <ZoneQR zones={d.byZone} />
    </div>
  )
}

function shortPeriod(p: Period): string {
  return p === 'today' ? "Auj." : p === 'week' ? 'Semaine' : p === 'month' ? 'Mois' : 'Tout'
}

function time(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })
}

function WaModal({ d, period, onClose }: { d: Dashboard; period: Period; onClose: () => void }) {
  const msg = buildWhatsAppSummary(d, period)
  const [copied, setCopied] = useState(false)
  return (
    <Modal title="Aperçu WhatsApp" onClose={onClose}>
      <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-2xl border border-ink/10 bg-white p-3 text-sm leading-relaxed text-ink">{msg}</pre>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => { void navigator.clipboard.writeText(msg); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
          className="tap rounded-[28px] border border-ink/15 bg-white py-3 text-sm font-bold text-ink"
        >
          {copied ? '✓ Copié' : 'Copier'}
        </button>
        <button type="button" onClick={() => shareWhatsApp(msg)} className="tap rounded-[28px] bg-wa py-3 text-sm font-bold text-white">
          Ouvrir WhatsApp
        </button>
      </div>
    </Modal>
  )
}

function AddRestaurantModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const valid = name.trim().length > 0 && email.includes('@') && pw.length >= 8

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    setBusy(true)
    setErr(null)
    try {
      await addRestaurant(name.trim(), email.trim(), pw)
      onDone()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Ajouter un restaurant" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom (Crousty Dison)" required />
        <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email du restaurant" required />
        <input className={inputCls} type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Mot de passe (≥ 8 car.)" required />
        {err && <p className="text-sm text-flame">{err}</p>}
        <button type="submit" disabled={!valid || busy} className="tap w-full rounded-[28px] bg-ink py-4 text-base font-extrabold text-white disabled:bg-mute disabled:text-ink/40">
          {busy ? '…' : 'Créer le restaurant'}
        </button>
        <p className="text-center text-[10px] leading-relaxed text-ink/40">
          Crée l'organisation + le compte tablette (RPC admin-only, migration 0003).
          Fallback CLI : <code>node scripts/add-restaurant.mjs "Nom" email "mdp≥8"</code>
        </p>
      </form>
    </Modal>
  )
}

function PinGate({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState('')
  const [shake, setShake] = useState(false)

  function submit(v: string) {
    if (v === '2026') onUnlock()
    else { setShake(true); setPin(''); setTimeout(() => setShake(false), 400) }
  }

  return (
    <div className={`mx-auto max-w-xs rounded-[28px] border border-ink/10 bg-white p-6 ${shake ? 'animate-pulse' : ''}`}>
      <p className="text-xs font-bold uppercase tracking-wide text-ink/50">Mode Foued — PIN requis</p>
      <p className="mb-4 mt-1 text-xs text-ink/45">Entre le code pour accéder aux stats</p>
      <p className="mb-5 font-mono text-3xl tracking-[0.4em] text-ink">{'•'.repeat(pin.length) || '————'}</p>
      <div className="grid grid-cols-3 gap-2">
        {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((k, i) => (
          <button
            key={i}
            type="button"
            disabled={!k}
            onClick={() => {
              if (k === '⌫') setPin((p) => p.slice(0, -1))
              else if (k) { const nv = pin + k; setPin(nv); if (nv.length === 4) submit(nv) }
            }}
            className="tap rounded-2xl border border-ink/10 bg-cream/40 py-3.5 text-xl font-bold text-ink hover:bg-cream disabled:border-0 disabled:bg-transparent"
          >
            {k}
          </button>
        ))}
      </div>
    </div>
  )
}

function Login({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null)
    try {
      await signIn(email, pw)
      // Un compte restaurant ne doit jamais ouvrir l'espace admin.
      if (!(await isAdmin())) {
        await signOut()
        throw new Error('Compte non autorisé — accès admin requis')
      }
      onDone()
    }
    catch (e) { setErr((e as Error).message) }
    finally { setBusy(false) }
  }

  return (
    <div className="mx-auto max-w-sm rounded-[28px] border border-ink/10 bg-white p-6 text-left">
      <p className="mb-4 text-sm font-extrabold uppercase tracking-wide text-ink/60">Connexion Foued</p>
      <form onSubmit={submit} className="space-y-3">
        <input className={inputCls} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className={inputCls} type="password" placeholder="Mot de passe" value={pw} onChange={(e) => setPw(e.target.value)} required />
        {err && <p className="text-sm text-flame">{err}</p>}
        <button type="submit" disabled={busy} className="tap w-full rounded-[28px] bg-flame py-3.5 text-base font-extrabold text-white disabled:bg-mute">
          {busy ? '…' : 'Se connecter'}
        </button>
      </form>
    </div>
  )
}

const inputCls = 'w-full rounded-2xl border border-ink/15 bg-cream/40 px-4 py-3 text-base font-semibold text-ink placeholder:text-ink/40 focus:border-ink focus:bg-white focus:outline-none'

function Pad({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-cream text-ink">
      <div className={`page-width px-4 py-12 text-center ${className ?? ''}`}>{children}</div>
    </main>
  )
}
