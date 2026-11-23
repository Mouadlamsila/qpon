import { useEffect, useState } from 'react'
import {
  fetchMyProfile,
  updateMyPassword,
  updateMyProfileInfo,
  type UserProfile,
} from '../lib/profile'
import { signOut } from '../lib/admin'
import { db } from '../lib/db'
import { navigate } from '../lib/router'
import { supabase } from '../lib/supabase'

export default function Profile() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  // Editable profile info
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [email, setEmail] = useState('')
  const [savingInfo, setSavingInfo] = useState(false)

  // Password change
  const [pw, setPw] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [savingPw, setSavingPw] = useState(false)
  const [pwErr, setPwErr] = useState<string | null>(null)

  function flash(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }
    let alive = true
    fetchMyProfile()
      .then((p) => {
        if (!alive) return
        setProfile(p)
        if (p) {
          setFullName(p.fullName)
          setPhone(p.phone)
          setJobTitle(p.jobTitle)
          setEmail(p.email)
        }
      })
      .catch((e) => {
        if (alive) setErr((e as Error).message)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  async function saveInfo(e: React.FormEvent) {
    e.preventDefault()
    setSavingInfo(true)
    setErr(null)
    try {
      const res = await updateMyProfileInfo({ fullName, phone, jobTitle, email })
      const refreshed = await fetchMyProfile()
      if (refreshed) setProfile(refreshed)
      flash(
        res.emailPendingConfirmation
          ? 'Infos enregistrées · Vérifie ton nouvel email pour confirmer'
          : 'Profil mis à jour',
      )
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setSavingInfo(false)
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwErr(null)
    if (pw.length < 8) {
      setPwErr('Minimum 8 caractères')
      return
    }
    if (pw !== pwConfirm) {
      setPwErr('Les mots de passe ne correspondent pas')
      return
    }
    setSavingPw(true)
    try {
      await updateMyPassword(pw)
      setPw('')
      setPwConfirm('')
      flash('Mot de passe mis à jour')
    } catch (e) {
      setPwErr((e as Error).message)
    } finally {
      setSavingPw(false)
    }
  }

  async function handleSignOut() {
    const pending = await db.pendingOrders.where('status').equals('pending').count()
    if (
      pending > 0 &&
      !window.confirm(`${pending} commande(s) pas encore synchronisée(s). Se déconnecter quand même ?`)
    ) {
      return
    }
    await signOut()
    navigate('/')
  }

  if (!supabase) {
    return (
      <main className="page-width px-4 py-12">
        <div className="rounded-[28px] border border-ink/10 bg-white p-6 text-center">
          <p className="text-sm font-semibold text-ink/60">
            Mode démo hors ligne — connecte Supabase pour gérer ton profil utilisateur.
          </p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="tap mt-4 rounded-full bg-ink px-4 py-2 text-xs font-bold text-white"
          >
            Retour à la caisse
          </button>
        </div>
      </main>
    )
  }

  if (loading) {
    return <div className="page-width px-4 py-16 text-center text-sm text-ink/40">Chargement du profil…</div>
  }

  if (!profile) {
    return (
      <main className="page-width px-4 py-12 text-center">
        <p className="text-sm text-ink/60">Session expirée ou non connecté.</p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="tap mt-4 rounded-full bg-ink px-5 py-2.5 text-xs font-bold text-white"
        >
          Se connecter
        </button>
      </main>
    )
  }

  const displayName = profile.fullName || profile.email.split('@')[0] || 'Utilisateur'
  const initials = displayName
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('') || 'U'
  const isAdmin = profile.role === 'admin_foued'

  return (
    <main className="min-h-dvh bg-cream text-ink">
      <div className="page-width space-y-4 px-4 py-5">
        {/* Top navigation */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate(isAdmin ? '/admin' : '/')}
              className="tap rounded-full border border-ink/15 bg-white px-3.5 py-1.5 text-xs font-bold text-ink/70 hover:text-ink"
            >
              ← {isAdmin ? 'Dashboard' : 'Caisse'}
            </button>
            <h1 className="text-lg font-extrabold tracking-tight">Mon profil</h1>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => navigate('/')}
              className="tap rounded-full border border-ink/15 bg-white px-3.5 py-1.5 text-xs font-bold text-ink/70"
            >
              Ouvrir Caisse
            </button>
          )}
        </div>

        {/* Identity Card */}
        <section className="flex flex-wrap items-center gap-4 rounded-[28px] border border-ink/10 bg-white p-5">
          <div className="grid size-14 shrink-0 place-items-center rounded-full bg-flame font-mono text-xl font-extrabold text-white">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-extrabold text-ink">{displayName}</h2>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                  isAdmin ? 'bg-flame/15 text-flame' : 'bg-ink/10 text-ink/70'
                }`}
              >
                {isAdmin ? 'Admin Foued' : 'Compte Restaurant'}
              </span>
              {profile.organizationName && (
                <span className="rounded-full bg-cream px-2.5 py-0.5 text-[11px] font-bold text-ink/70">
                  {profile.organizationName}
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-xs font-medium text-ink/50">{profile.email}</p>
            {profile.createdAt && (
              <p className="mt-1 text-[11px] text-ink/40">
                Membre depuis le {new Date(profile.createdAt).toLocaleDateString('fr-BE')}
              </p>
            )}
          </div>
        </section>

        {err && <p className="rounded-2xl bg-flame/15 p-3 text-sm font-medium text-flame">{err}</p>}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Personal Info Form */}
          <section className="rounded-[28px] border border-ink/10 bg-white p-5 lg:col-span-2">
            <h3 className="mb-1 text-sm font-extrabold text-ink">Informations personnelles</h3>
            <p className="mb-4 text-xs text-ink/50">
              Mets à jour tes coordonnées et ton nom affiché sur Orkesta OS.
            </p>

            <form onSubmit={saveInfo} className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink/50">
                    Nom complet
                  </span>
                  <input
                    className={inputCls}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ex: Foued Benali"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink/50">
                    Poste / Rôle affiché
                  </span>
                  <input
                    className={inputCls}
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="Ex: Gérant, Responsable caisse"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink/50">
                    Téléphone
                  </span>
                  <input
                    className={inputCls}
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+32 470 00 00 00"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink/50">
                    Adresse email
                  </span>
                  <input
                    className={inputCls}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </label>
              </div>

              <div className="flex items-center justify-end pt-2">
                <button
                  type="submit"
                  disabled={savingInfo}
                  className="tap rounded-full bg-flame px-6 py-3 text-sm font-extrabold text-white disabled:bg-mute disabled:text-ink/40"
                >
                  {savingInfo ? 'Enregistrement…' : 'Enregistrer les modifications'}
                </button>
              </div>
            </form>
          </section>

          {/* Security / Password + Session */}
          <div className="space-y-4">
            <section className="rounded-[28px] border border-ink/10 bg-white p-5">
              <h3 className="mb-1 text-sm font-extrabold text-ink">Sécurité</h3>
              <p className="mb-4 text-xs text-ink/50">Modifier ton mot de passe de connexion.</p>

              <form onSubmit={savePassword} className="space-y-3">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink/50">
                    Nouveau mot de passe
                  </span>
                  <input
                    className={inputCls}
                    type="password"
                    value={pw}
                    onChange={(e) => setPw(e.target.value)}
                    placeholder="Minimum 8 caractères"
                    required
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink/50">
                    Confirmer
                  </span>
                  <input
                    className={inputCls}
                    type="password"
                    value={pwConfirm}
                    onChange={(e) => setPwConfirm(e.target.value)}
                    placeholder="Répéter le mot de passe"
                    required
                  />
                </label>

                {pwErr && <p className="text-xs font-semibold text-flame">{pwErr}</p>}

                <button
                  type="submit"
                  disabled={savingPw || !pw || !pwConfirm}
                  className="tap w-full rounded-full bg-ink py-3 text-sm font-extrabold text-white disabled:bg-mute disabled:text-ink/40"
                >
                  {savingPw ? 'Mise à jour…' : 'Changer le mot de passe'}
                </button>
              </form>
            </section>

            <section className="rounded-[28px] border border-ink/10 bg-white p-5">
              <h3 className="mb-1 text-sm font-extrabold text-ink">Session</h3>
              <p className="mb-3 text-xs text-ink/50">
                Déconnecte cet appareil pour changer de compte.
              </p>
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="tap w-full rounded-full border border-flame/30 bg-flame/5 py-2.5 text-xs font-extrabold text-flame hover:bg-flame/10"
              >
                Se déconnecter
              </button>
            </section>
          </div>
        </div>
      </div>

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center">
          <p className="rounded-full bg-ink px-4 py-2 text-sm font-bold text-white shadow-lg">
            {toast}
          </p>
        </div>
      )}
    </main>
  )
}

const inputCls =
  'w-full rounded-2xl border border-ink/15 bg-cream/40 px-3.5 py-2.5 text-sm font-semibold text-ink placeholder:text-ink/35 focus:border-ink focus:bg-white focus:outline-none'

