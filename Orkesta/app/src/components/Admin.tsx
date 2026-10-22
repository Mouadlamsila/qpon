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
      <div className="page-width px-4 py-4">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-lg font-extrabold">DASHBOARD FOUED</h1>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink/40">Performance temps réel</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={orgId ?? ''}
              onChange={(e) => setOrgId(e.target.value || null)}
              className="max-w-44 rounded-full border border-ink/15 bg-white px-3 py-1.5 text-xs font-bold text-ink focus:outline-none"
            >
              <option value="" className="text-ink">Tous clients</option>
              {(dash?.orgs ?? []).map((o) => (
                <option key={o.id} value={o.id} className="text-ink">{o.name}</option>
              ))}
            </select>
            <div className="flex overflow-hidden rounded-full border border-ink/15 text-[11px] font-bold">
              {(['today', 'week', 'month', 'all'] as Period[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={`px-2.5 py-1.5 ${period === p ? 'bg-flame text-white' : 'text-ink/60'}`}
                >
                  {shortPeriod(p)}
                </button>
              ))}
            </div>
            <button onClick={() => setShowAdd(true)} className="tap rounded-full border border-ink/15 bg-white px-3 py-1.5 text-xs font-bold text-ink/70">
              + Restaurant
            </button>
            <button onClick={() => navigate('/')} className="tap rounded-full border border-ink/15 bg-white px-3 py-1.5 text-xs font-bold text-ink/70">
              Caisse
            </button>
            <button onClick={() => void lock()} className="tap rounded-full border border-ink/15 bg-white px-3 py-1.5 text-xs font-bold text-ink/70">
              Lock
            </button>
          </div>
        </div>

        {err && <p className="mb-3 rounded-2xl bg-flame/15 p-3 text-sm text-flame">{err}</p>}

        {!dash ? (
          <p className="py-16 text-center text-sm text-ink/40">Chargement stats…</p>
        ) : (
          <Stats
            d={dash}
            period={period}
            cost={cost}
            onCost={setCost}
            onSaveCost={() => void saveCost()}
            onCsv={() => void exportCsv(period, orgId).catch((e) => setErr((e as Error).message))}
            onWa={() => setShowWa(true)}
            onTogglePromo={(id, active) => void togglePromo(id, active)}
            onFlyers={(id, n) => void changeFlyers(id, n)}
          />
        )}

        {/* Dev only — session/RLS/sync en clair, sans console */}
        {import.meta.env.DEV && <div className="mt-4"><DebugPanel /></div>}
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
  d, period, cost, onCost, onSaveCost, onCsv, onWa, onTogglePromo, onFlyers,
}: {
  d: Dashboard
  period: Period
  cost: string
  onCost: (v: string) => void
  onSaveCost: () => void
  onCsv: () => void
  onWa: () => void
  onTogglePromo: (id: string, active: boolean) => void
  onFlyers: (id: string, n: number) => void
}) {
  const delta = d.prev && d.prev.caTotal > 0
    ? ((d.caTotal - d.prev.caTotal) / d.prev.caTotal) * 100
    : null

  return (
    <div className="space-y-4">
      {/* KPI — BRIEF §5.3 + §6 */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
        <Kpi label="Distribués" value={String(d.distribues)} />
        <Kpi label="Utilisés" value={String(d.utilises)} />
        <Kpi label="Taux" value={`${d.taux.toFixed(1)}%`} />
        <Kpi label="CA Total" value={`${d.caTotal.toFixed(2)}€`} accent />
        <Kpi label="Panier moyen" value={`${d.panierMoyen.toFixed(2)}€`} />
        <Kpi label="Sur place" value={`${d.caSurPlace.toFixed(2)}€`} />
        <Kpi label="Livraison" value={`${d.caLivraison.toFixed(2)}€`} />
        <Kpi label="Uber" value={`${d.caUber.toFixed(2)}€`} />
        <Kpi label="Takeaway" value={`${d.caTakeaway.toFixed(2)}€`} />
        <Kpi label="Appli" value={`${d.caAppli.toFixed(2)}€`} />
      </div>

      {/* ROI / coût / comparaison */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Kpi label="Coût campagne" value={`${d.cost.toFixed(2)}€`} />
        <Kpi label="Coût / commande" value={`${d.costPerOrder.toFixed(2)}€`} />
        <Kpi label="ROI" value={d.roi === null ? '—' : `${d.roi.toFixed(1)}%`} />
        <Kpi
          label="vs période préc."
          value={delta === null ? '—' : `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`}
          accent={delta !== null && delta < 0}
        />
      </div>

      {/* Coût campagne : saisi par Foued (BRIEF §6) */}
      {d.orgId && (
        <div className="flex gap-2">
          <input
            value={cost}
            onChange={(e) => onCost(e.target.value.replace(/[^\d.]/g, ''))}
            placeholder="Coût campagne € (ex: 250)"
            inputMode="decimal"
            className="min-w-0 flex-1 rounded-2xl border border-ink/15 bg-white px-4 py-3 text-base font-semibold text-ink placeholder:text-ink/30 focus:border-ink focus:outline-none"
          />
          <button type="button" onClick={onSaveCost} className="tap shrink-0 rounded-2xl bg-flame px-4 text-sm font-bold text-white">
            Ajouter
          </button>
        </div>
      )}

      {/* Actions rapport */}
      <div className="grid grid-cols-2 gap-2 md:max-w-md">
        <button type="button" onClick={onCsv} className="tap rounded-[20px] border border-ink/15 bg-white py-3 text-sm font-bold text-ink">
          Export CSV
        </button>
        <button type="button" onClick={onWa} className="tap rounded-[20px] bg-wa py-3 text-sm font-bold text-white">
          Résumé WhatsApp
        </button>
      </div>

      {/* Table par zone — BRIEF §5.5 */}
      <section>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink/50">Table par zone</h2>
        <div className="overflow-hidden rounded-[28px] border border-ink/10 bg-white">
          {d.byZone.length === 0 && <p className="p-4 text-center text-sm text-ink/40">Aucune zone</p>}
          {d.byZone.map((z) => (
            <div key={z.id} className="flex items-center gap-2 border-b border-ink/5 px-4 py-3 text-sm last:border-0">
              <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: z.color }} />
              <span className="min-w-0 flex-1 truncate font-semibold">{z.name}</span>
              <span className="flex shrink-0 items-center gap-1 text-[10px] text-ink/40">
                <input
                  key={z.flyersDistributed}
                  type="number"
                  defaultValue={z.flyersDistributed}
                  onBlur={(e) => {
                    if (e.target.value === '') { e.target.value = String(z.flyersDistributed); return }
                    const n = Number(e.target.value)
                    if (Number.isFinite(n) && n !== z.flyersDistributed) onFlyers(z.id, n)
                  }}
                  className="w-16 rounded-lg border border-ink/15 bg-white px-1.5 py-0.5 text-right font-mono text-[11px] text-ink focus:border-ink focus:outline-none"
                  aria-label={`Flyers distribués ${z.name}`}
                />
                posés
              </span>
              <span className="shrink-0 text-ink/60">{z.used} util.</span>
              <span className="shrink-0 font-mono text-xs font-bold text-ink/70">{z.taux.toFixed(1)}%</span>
              <span className="shrink-0 font-mono text-xs font-bold text-flame">{z.ca.toFixed(0)}€</span>
            </div>
          ))}
        </div>
      </section>

      {/* Table par promo — BRIEF §5.6 */}
      <section>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink/50">Table par promo</h2>
        <div className="overflow-hidden rounded-[28px] border border-ink/10 bg-white">
          {d.byPromo.length === 0 && <p className="p-4 text-center text-sm text-ink/40">Aucune promo</p>}
          {d.byPromo.map((p) => (
            <div key={p.id} className="flex items-center gap-2 border-b border-ink/5 px-4 py-3 text-sm last:border-0">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{p.name}</span>
                <span className="block font-mono text-[10px] text-ink/40">{p.pricePlace}€ / {p.priceDelivery}€</span>
              </span>
              <span className="shrink-0 text-ink/60">{p.used} util.</span>
              <span className="shrink-0 font-mono text-xs font-bold text-flame">{p.ca.toFixed(0)}€</span>
              <button
                type="button"
                onClick={() => onTogglePromo(p.id, !p.active)}
                className={`tap shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${p.active ? 'bg-cream text-ink/60' : 'bg-wa/20 text-wa'}`}
              >
                {p.active ? 'Désactiver' : 'Activer'}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Clients (restaurants) + panier moyen — BRIEF §5.7 / §9.5 */}
      {d.orgId === null && d.byOrg.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink/50">Clients — classement rentabilité</h2>
          <div className="overflow-hidden rounded-[28px] border border-ink/10 bg-white">
            {d.byOrg.map((o, i) => (
              <div key={o.id} className="flex items-center gap-2 border-b border-ink/5 px-4 py-3 text-sm last:border-0">
                <span className="w-5 shrink-0 font-mono text-xs font-bold text-ink/40">#{i + 1}</span>
                <span className="min-w-0 flex-1 truncate font-semibold">{o.name}</span>
                <span className="shrink-0 text-ink/50">{o.orders} cmd</span>
                <span className="shrink-0 font-mono text-xs font-bold text-flame">{o.ca.toFixed(0)}€</span>
                <span className="hidden shrink-0 font-mono text-[10px] text-ink/40 sm:inline">panier {o.panierMoyen.toFixed(1)}€</span>
                <span className={`shrink-0 font-mono text-xs font-bold ${o.roi === null ? 'text-ink/30' : o.roi >= 0 ? 'text-wa' : 'text-flame'}`}>
                  {o.roi === null ? '—' : `${o.roi.toFixed(0)}%`}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Dernières commandes — heure + restaurant + zone + promo + canal + montant */}
      <section>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink/50">Dernières commandes</h2>
        {d.recent.length === 0 ? (
          <p className="rounded-[28px] border border-dashed border-ink/15 p-4 text-center text-sm text-ink/40">Aucune commande</p>
        ) : (
          <ul className="space-y-1.5 md:grid md:grid-cols-2 md:gap-1.5 md:space-y-0">
            {d.recent.map((o) => (
              <li key={o.id} className="rounded-2xl border border-ink/10 bg-white px-3 py-2.5 text-sm">
                <div className="flex items-center gap-2">
                  <span className="shrink-0 font-mono text-[10px] text-ink/40">{time(o.createdAt)}</span>
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: o.zoneColor }} />
                  <span className="min-w-0 flex-1 truncate font-semibold">{o.promoName}</span>
                  <span className="shrink-0 font-mono text-xs font-bold">{o.amount}€</span>
                </div>
                <p className="mt-0.5 truncate pl-10 text-[10px] text-ink/40">
                  {o.orgName} · {o.zoneName} · {o.channel}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* P5 — QR par zone (scan → ?zone= → pré-remplit) */}
      <ZoneQR zones={d.byZone} />

      <p className="pb-6 text-center text-[10px] text-ink/30">Période : {periodLabel(period)}</p>
    </div>
  )
}

function shortPeriod(p: Period): string {
  return p === 'today' ? "Auj." : p === 'week' ? 'Semaine' : p === 'month' ? 'Mois' : 'Tout'
}

function time(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' })
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-[28px] p-4 ${accent ? 'bg-flame text-white' : 'border border-ink/10 bg-white text-ink'}`}>
      <p className={`text-[11px] font-bold uppercase ${accent ? 'text-white/70' : 'text-ink/50'}`}>{label}</p>
      <p className="mt-1 text-xl font-extrabold">{value}</p>
    </div>
  )
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
          Crée l'organisation + le compte tablette. Nécessite la fonction Edge `add-restaurant` déployée.
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
    <div className={shake ? 'animate-pulse' : ''}>
      <p className="text-sm font-bold uppercase text-ink/50">Mode Foued — PIN requis</p>
      <p className="mb-4 text-xs text-ink/40">Entre le code pour accéder aux stats</p>
      <p className="mb-4 font-mono text-3xl tracking-[0.4em] text-ink">{'•'.repeat(pin.length) || '————'}</p>
      <div className="grid grid-cols-3 gap-2">
        {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((k, i) => (
          <button
            key={i}
            disabled={!k}
            onClick={() => {
              if (k === '⌫') setPin((p) => p.slice(0, -1))
              else if (k) { const nv = pin + k; setPin(nv); if (nv.length === 4) submit(nv) }
            }}
            className="tap rounded-2xl border border-ink/10 bg-white py-4 text-xl font-bold text-ink disabled:border-0 disabled:bg-transparent"
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
    <>
      <p className="mb-4 text-sm font-bold uppercase text-ink/50">Connexion Foued</p>
      <form onSubmit={submit} className="space-y-3">
        <input className={inputCls} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className={inputCls} type="password" placeholder="Mot de passe" value={pw} onChange={(e) => setPw(e.target.value)} required />
        {err && <p className="text-sm text-flame">{err}</p>}
        <button type="submit" disabled={busy} className="tap w-full rounded-[28px] bg-flame py-4 text-base font-extrabold text-white disabled:bg-mute">
          {busy ? '…' : 'Se connecter'}
        </button>
      </form>
    </>
  )
}

const inputCls = 'w-full rounded-2xl border border-ink/15 bg-white px-4 py-3 text-base font-semibold text-ink placeholder:text-ink/40 focus:border-ink focus:outline-none'

function Pad({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-cream text-ink">
      <div className={`page-width px-4 py-16 text-center ${className ?? ''}`}>{children}</div>
    </main>
  )
}
