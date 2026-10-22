import { useEffect, useState } from 'react'

// Routes minimales (pas de dépendance) : / = caisse, /admin = admin.
// Sécurité = RLS côté serveur ; les routes ne sont que de l'UX.
const EVT = 'orkesta:navigate'

export function navigate(path: string): void {
  if (window.location.pathname === path) return
  window.history.pushState({}, '', path)
  window.dispatchEvent(new Event(EVT))
}

export function usePath(): string {
  const [path, setPath] = useState(() => window.location.pathname)
  useEffect(() => {
    const update = () => setPath(window.location.pathname)
    window.addEventListener('popstate', update)
    window.addEventListener(EVT, update)
    return () => {
      window.removeEventListener('popstate', update)
      window.removeEventListener(EVT, update)
    }
  }, [])
  return path
}
