import { useState } from 'react'
import { diagnose, forceSync, type Diag } from '../lib/diag'

// Dev-only : diagnostic lisible sans console. À retirer en prod.
export default function DebugPanel() {
  const [d, setD] = useState<Diag | null>(null)
  const [busy, setBusy] = useState(false)

  async function run(fn: () => Promise<Diag>) {
    setBusy(true)
    try { setD(await fn()) } finally { setBusy(false) }
  }

  return (
    <section className="rounded-[28px] border border-flame/30 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wide text-flame">Diagnostic (dev)</h2>
        <span className="rounded-full bg-flame/10 px-2 py-0.5 text-[10px] font-bold text-flame">diag-4</span>
      </div>

      <div className="flex gap-2">
        <button type="button" disabled={busy} onClick={() => void run(diagnose)} className="tap flex-1 rounded-full border border-ink/15 py-2 text-xs font-bold text-ink disabled:opacity-40">
          Diagnostic
        </button>
        <button type="button" disabled={busy} onClick={() => void run(forceSync)} className="tap flex-1 rounded-full bg-ink py-2 text-xs font-bold text-white disabled:opacity-40">
          Sync maintenant
        </button>
      </div>

      {d && (
        <div className="mt-3 space-y-2 text-[11px]">
          <Row k="online" v={String(d.online)} bad={!d.online} />
          <Row k="supabase" v={String(d.supabase)} bad={!d.supabase} />
          <Row k="user" v={d.user ? `${d.user.email} · ${d.user.id}` : 'AUCUN'} bad={!d.user} />
          <Row k="session" v={String(d.session)} bad={!d.session} />
          <Row k="isAdmin" v={String(d.isAdmin)} bad={d.isAdmin !== true} />

          <div className="rounded-xl bg-cream p-2 font-mono">
            <p className="mb-1 font-bold text-ink/60">SERVEUR (RLS)</p>
            {Object.entries(d.tables).map(([t, r]) => (
              <p key={t} className={r.error ? 'text-flame' : 'text-ink'}>
                {t}: {r.error ? `ERREUR ${r.error}` : `${r.count} rows`}
              </p>
            ))}
          </div>

          <div className="rounded-xl bg-cream p-2 font-mono">
            <p className="mb-1 font-bold text-ink/60">LOCAL (Dexie)</p>
            <p>orgs {d.local.orgs} · zones {d.local.zones} · promos {d.local.promos}</p>
            <p className={d.local.pending > 0 ? 'text-flame' : 'text-ink'}>
              pending {d.local.pending} · error {d.local.error}
            </p>
            {d.pendingRows.map((r) => (
              <p key={r.id} className="text-ink/70">
                {r.id} [{r.status}] org {r.org} zone {r.zone}
              </p>
            ))}
          </div>

          <div className="rounded-xl bg-ink p-2 font-mono text-white/80">
            <p className="mb-1 font-bold text-white/50">DERNIERS LOGS SYNC</p>
            {d.syncLog.length === 0 ? <p>—</p> : d.syncLog.map((l, i) => <p key={i}>{l}</p>)}
          </div>
        </div>
      )}
    </section>
  )
}

function Row({ k, v, bad }: { k: string; v: string; bad: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 font-mono">
      <span className="text-ink/50">{k}</span>
      <span className={bad ? 'font-bold text-flame' : 'font-bold text-wa'}>{v}</span>
    </div>
  )
}
