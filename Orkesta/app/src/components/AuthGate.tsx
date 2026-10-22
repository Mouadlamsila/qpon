import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { db, wipeLocal } from '../lib/db'
import { pullReference } from '../lib/sync'

// Porte d'entrée de la caisse : sans session, pas d'accès.
// Une tablette = un compte restaurant → un seul tenant visible (RLS).
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<'checking' | 'anon' | 'authed'>('checking')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!supabase) {
      setState('authed') // mode démo offline (Supabase non configuré)
      return
    }
    // getSession = local (fonctionne offline une fois activée)
    void supabase.auth.getSession().then(({ data }) => setState(data.session ? 'authed' : 'anon'))
    const { data } = supabase.auth.onAuthStateChange((e, s) => {
      if (e === 'SIGNED_OUT') setState('anon')
      else if (e === 'INITIAL_SESSION') setState(s ? 'authed' : 'anon')
      // SIGNED_IN : attendu par afterLogin (après purge/pull du tenant)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  async function afterLogin() {
    if (!supabase) return
    try {
      // Sépare les restaurants : si le compte n'est pas le tenant local → purge.
      const { data: u } = await supabase.auth.getUser()
      const { data: prof } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', u.user?.id ?? '')
        .single()
      const orgId = prof?.organization_id ?? null
      const local = await db.orgs.toArray()
      if (!local.some((o) => o.id === orgId)) await wipeLocal()
      await pullReference() // server = source of truth (zones/promos du tenant)
      setPw('')
    } catch (e) {
      // Réseau : la session est valide, le moteur de sync rattrapera.
      console.error('[auth] post-login:', e)
    } finally {
      setState('authed')
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setBusy(true)
    setErr(null)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pw })
      if (error) throw error
      await afterLogin()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (state === 'checking') return <Pad>Chargement…</Pad>
  if (state === 'authed') return <>{children}</>

  return (
    <main className="page-width px-4 py-16">
      <div className="mx-auto max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <span className="grid size-10 place-items-center rounded-full bg-flame font-mono text-xl font-bold text-white">O</span>
          <span className="text-lg font-extrabold tracking-tight text-ink">ORKESTA OS</span>
        </div>

        <h1 className="text-2xl font-extrabold text-ink">Connexion restaurant</h1>
        <p className="mb-5 mt-1 text-sm text-ink/60">
          Active la caisse une seule fois. La session reste active après (même hors ligne).
        </p>

        <form onSubmit={submit} className="space-y-3">
          <input
            className={inputCls}
            type="email"
            placeholder="Email du restaurant"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className={inputCls}
            type="password"
            placeholder="Mot de passe"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            required
          />
          {err && <p className="text-sm text-flame">{err}</p>}
          <button type="submit" disabled={busy} className="tap w-full rounded-[28px] bg-ink py-4 text-base font-extrabold text-white disabled:bg-mute">
            {busy ? '…' : 'Activer la caisse'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-ink/40">
          Pas de compte ? Contacte ton administrateur.
        </p>
      </div>
    </main>
  )
}

const inputCls =
  'w-full rounded-2xl border border-ink/10 bg-white px-4 py-3 text-base font-semibold text-ink placeholder:text-ink/30 focus:border-ink focus:outline-none'

function Pad({ children }: { children: React.ReactNode }) {
  return <div className="page-width px-4 py-16 text-center text-sm text-ink/40">{children}</div>
}
