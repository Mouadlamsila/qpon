import { useEffect } from 'react'
import Header from './components/Header'
import Caisse from './components/Caisse'
import Admin from './components/Admin'
import AuthGate from './components/AuthGate'
import { seedIfEmpty } from './lib/seed'
import { startSyncEngine } from './lib/sync'
import { wipeLocal } from './lib/db'
import { supabase } from './lib/supabase'
import { usePath } from './lib/router'

// / = Caisse (tablette) · /admin = Dashboard Foued. Séparation nette.
export default function App() {
  const path = usePath()
  const isAdmin = path === '/admin' || path.startsWith('/admin/')

  useEffect(() => {
    // Démo offline uniquement : avec Supabase, la caisse attend le login (AuthGate)
    // puis tire les données du serveur (source of truth).
    if (!supabase) void seedIfEmpty()
    // Moteur sync : interval + online + visibilitychange (P2).
    const stopEngine = startSyncEngine()
    // P6 — Révocation : sign-out (collaboration stoppée) → tablette vidée (BRIEF §8).
    const { data: sub } = supabase?.auth.onAuthStateChange((ev) => {
      if (ev === 'SIGNED_OUT') void wipeLocal()
    }) ?? { data: null }
    return () => {
      stopEngine()
      sub?.subscription.unsubscribe()
    }
  }, [])

  return (
    <div className="min-h-dvh bg-cream text-ink">
      <Header />
      {isAdmin ? <Admin /> : <AuthGate><Caisse /></AuthGate>}
    </div>
  )
}
