import { useEffect, useState } from 'react'
import { isAdmin, loadDashboard, signIn, signOut, type Dashboard } from '../lib/admin'
import { buildWhatsAppSummary, exportCsv, shareWhatsApp, type Period } from '../lib/reports'
import { supabase } from '../lib/supabase'
import { db } from '../lib/db'
import { navigate } from '../lib/router'
import DebugPanel from './DebugPanel'
import ZoneQR from './ZoneQR'

// Mode Admin — PIN 2026 (UX) + Supabase Auth (vraie sécurité) + dashboard.
export default function Admin() {
  const [unlocked, setUnlocked] = useState(false)
  const [authed, setAuthed] = useState(false)
  const [checking, setChecking] = useState(true)
  const [dash, setDash] = useState<Dashboard | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [period, setPeriod] = useState<Period>('all')

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
    isAdmin().then((v) => { setAuthed(v); setUnlocked(v); setChecking(false) })
  }, [])

  // Charge dashboard une fois authed (et à chaque changement de période).
  useEffect(() => {
    if (!authed) return
    loadDashboard(period).then(setDash).catch((e) => setErr(e.message))
  }, [authed, period])

  if (checking) return <Pad className="text-ink/40">Chargement…</Pad>
  if (!supabase) return <Pad className="text-ink/60">Supabase non configuré (remplir .env)</Pad>

  if (!unlocked) return <PinGate onUnlock={() => setUnlocked(true)} />
  if (!authed) return <Login onDone={() => { setAuthed(true); navigate('/admin') }} />

  return (
    <main className="page-width px-4 py-4">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="text-lg font-extrabold text-ink">DASHBOARD FOUED</h1>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-full border border-ink/15 bg-white text-[11px] font-bold">
            <button type="button" onClick={() => setPeriod('all')} className={`px-2.5 py-1.5 ${period === 'all' ? 'bg-ink text-white' : 'text-ink/60'}`}>
              TOUT
            </button>
            <button type="button" onClick={() => setPeriod('today')} className={`px-2.5 py-1.5 ${period === 'today' ? 'bg-ink text-white' : 'text-ink/60'}`}>
              AUJOURD'HUI
            </button>
          </div>
          <button onClick={() => navigate('/')} className="tap rounded-full border border-ink/15 bg-white px-3 py-1.5 text-xs font-bold text-ink/60">
            Caisse
          </button>
          <button onClick={() => void lock()} className="tap rounded-full border border-ink/15 bg-white px-3 py-1.5 text-xs font-bold text-ink/60">
            Lock
          </button>
        </div>
      </div>

      {err && <p className="mb-3 rounded-2xl bg-flame/10 p-3 text-sm text-flame">{err}</p>}
      {!dash ? (
        <Pad className="text-ink/40">Chargement stats…</Pad>
      ) : (
        <Stats d={dash} period={period} onError={setErr} />
      )}

      {/* Dev only — session/RLS/sync en clair, sans console */}
      {import.meta.env.DEV && <div className="mt-4"><DebugPanel /></div>}
    </main>
  )
}

function Stats({ d, period, onError }: { d: Dashboard; period: Period; onError: (m: string) => void }) {
  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        <Kpi label="Distribués" value={String(d.distribues)} />
        <Kpi label="Utilisés" value={String(d.utilises)} />
        <Kpi label="Taux" value={`${d.taux.toFixed(1)}%`} />
        <Kpi label="CA Total" value={`${d.caTotal.toFixed(2)}€`} accent />
        <Kpi label="Sur place" value={`${d.caSurPlace.toFixed(2)}€`} />
        <Kpi label="Livraison" value={`${d.caLivraison.toFixed(2)}€`} />
      </div>

      {/* P4 — actions rapport */}
      <div className="grid grid-cols-2 gap-2 md:max-w-md">
        <button type="button" onClick={() => void exportCsv(period).catch((e) => onError((e as Error).message))} className="tap rounded-[20px] border border-ink/15 bg-white py-3 text-sm font-bold text-ink">
          Export CSV
        </button>
        <button type="button" onClick={() => shareWhatsApp(buildWhatsAppSummary(d, period))} className="tap rounded-[20px] bg-wa py-3 text-sm font-bold text-white">
          Résumé WhatsApp
        </button>
      </div>

      {/* Table par zone */}
      <section>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink/50">Table par zone</h2>
        <div className="overflow-hidden rounded-[28px] border border-ink/10 bg-white">
          {d.byZone.map((z) => (
            <div key={z.id} className="flex items-center gap-2 border-b border-ink/5 px-4 py-3 text-sm last:border-0">
              <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: z.color }} />
              <span className="min-w-0 flex-1 truncate font-semibold text-ink">{z.name}</span>
              <span className="shrink-0 text-ink/50">{z.flyersDistributed} posés</span>
              <span className="shrink-0 font-bold text-ink">{z.used}</span>
              <span className="shrink-0 font-mono text-xs font-bold text-flame">{z.ca.toFixed(0)}€</span>
            </div>
          ))}
        </div>
      </section>

      {/* Dernières commandes */}
      <section>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink/50">Dernières commandes</h2>
        {d.recent.length === 0 ? (
          <p className="rounded-[28px] border border-dashed border-ink/15 p-4 text-center text-sm text-ink/40">Aucune commande</p>
        ) : (
          <ul className="space-y-1.5 md:grid md:grid-cols-2 md:gap-1.5 md:space-y-0">
            {d.recent.map((o) => (
              <li key={o.id} className="flex items-center gap-2 rounded-2xl border border-ink/10 bg-white px-3 py-2.5 text-sm">
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: o.zoneColor }} />
                <span className="min-w-0 flex-1 truncate font-semibold text-ink">{o.promoName}</span>
                <span className="shrink-0 rounded-full bg-cream px-2 py-0.5 text-[10px] font-bold uppercase text-ink/60">{o.channel}</span>
                <span className="shrink-0 font-mono text-xs font-bold text-ink">{o.amount}€</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* P5 — QR par zone (scan → ?zone= → pré-remplit) */}
      <ZoneQR zones={d.byZone} />
    </div>
  )
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-[28px] p-4 ${accent ? 'bg-flame text-white' : 'border border-ink/10 bg-white text-ink'}`}>
      <p className={`text-[11px] font-bold uppercase ${accent ? 'text-white/70' : 'text-ink/50'}`}>{label}</p>
      <p className="mt-1 text-2xl font-extrabold">{value}</p>
    </div>
  )
}

// PIN 2026 — UX only. La vraie sécurité = Supabase Auth (Login ci-dessous).
function PinGate({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState('')
  const [shake, setShake] = useState(false)

  function submit(v: string) {
    if (v === '2026') onUnlock()
    else { setShake(true); setPin(''); setTimeout(() => setShake(false), 400) }
  }

  return (
    <Pad>
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
    </Pad>
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
    <Pad>
      <p className="mb-4 text-sm font-bold uppercase text-ink/50">Connexion Foued</p>
      <form onSubmit={submit} className="space-y-3">
        <input className={inputCls} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className={inputCls} type="password" placeholder="Mot de passe" value={pw} onChange={(e) => setPw(e.target.value)} required />
        {err && <p className="text-sm text-flame">{err}</p>}
        <button type="submit" disabled={busy} className="tap w-full rounded-[28px] bg-ink py-4 text-base font-extrabold text-white disabled:bg-mute">
          {busy ? '…' : 'Se connecter'}
        </button>
      </form>
    </Pad>
  )
}

const inputCls = 'w-full rounded-2xl border border-ink/10 bg-white px-4 py-3 text-base font-semibold text-ink placeholder:text-ink/30 focus:border-ink focus:outline-none'

function Pad({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={`page-width px-4 py-16 text-center ${className ?? ''}`}>{children}</div>
}
