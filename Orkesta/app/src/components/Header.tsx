import { navigate, usePath } from '../lib/router'
import { useIsAdmin } from '../lib/admin'

// ORKESTA OS — brand + lien Admin (uniquement si session admin).
export default function Header() {
  const path = usePath()
  const admin = useIsAdmin()
  const onAdmin = path === '/admin' || path.startsWith('/admin/')

  return (
    <header className={`sticky top-0 z-20 border-b ${onAdmin ? 'border-white/10 bg-ink' : 'border-ink/10 bg-cream'}`}>
      <div className="page-width flex items-center gap-2.5 px-4 py-3">
        <span className="grid size-9 place-items-center rounded-full bg-flame font-mono text-xl font-bold text-white">
          O
        </span>
        <span className={`text-[15px] font-extrabold tracking-tight ${onAdmin ? 'text-white' : 'text-ink'}`}>
          ORKESTA OS
        </span>
        {admin && !onAdmin && (
          <button
            type="button"
            onClick={() => navigate('/admin')}
            className="ml-auto rounded-full border border-ink/15 bg-white px-3 py-1.5 text-xs font-bold text-ink/60"
          >
            Admin
          </button>
        )}
      </div>
    </header>
  )
}
