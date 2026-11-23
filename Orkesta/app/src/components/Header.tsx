import { navigate, usePath } from '../lib/router'
import { useIsAdmin } from '../lib/admin'
import { useAuthUser } from '../lib/profile'

// ORKESTA OS — brand + lien Admin (si admin) + Profil (si connecté).
export default function Header() {
  const path = usePath()
  const admin = useIsAdmin()
  const user = useAuthUser()
  const onAdmin = path === '/admin' || path.startsWith('/admin/')
  const onProfile = path === '/profile' || path.startsWith('/profile/')

  const label = user?.fullName || user?.email.split('@')[0] || 'Profil'
  const initials =
    label
      .split(/[\s._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? '')
      .join('') || 'U'

  return (
    <header className="sticky top-0 z-20 border-b border-ink/10 bg-cream/95 backdrop-blur-sm">
      <div className="page-width flex items-center gap-2.5 px-4 py-3">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="tap flex items-center gap-2.5 text-left"
        >
          <span className="grid size-9 place-items-center rounded-full bg-flame font-mono text-xl font-bold text-white">
            O
          </span>
          <span className="text-[15px] font-extrabold tracking-tight text-ink">
            ORKESTA OS
          </span>
        </button>

        <div className="ml-auto flex items-center gap-2">
          {admin && !onAdmin && (
            <button
              type="button"
              onClick={() => navigate('/admin')}
              className="tap rounded-full border border-ink/15 bg-white px-3 py-1.5 text-xs font-bold text-ink/70 hover:text-ink"
            >
              Dashboard
            </button>
          )}
          {user && (
            <button
              type="button"
              onClick={() => navigate('/profile')}
              className={`tap flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-xs font-bold transition-colors ${
                onProfile
                  ? 'border-ink bg-ink text-white'
                  : 'border-ink/15 bg-white text-ink/80 hover:border-ink/30'
              }`}
            >
              <span
                className={`grid size-6 place-items-center rounded-full font-mono text-[10px] font-extrabold ${
                  onProfile ? 'bg-flame text-white' : 'bg-cream text-ink'
                }`}
              >
                {initials}
              </span>
              <span className="max-w-28 truncate">{label}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
