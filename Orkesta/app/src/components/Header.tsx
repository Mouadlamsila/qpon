// ORKESTA OS — brand only. Pas de toggle : caisse = /, admin = /admin.
export default function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-ink/10 bg-cream">
      <div className="page-width flex items-center gap-2.5 px-4 py-3">
        <span className="grid size-9 place-items-center rounded-full bg-flame font-mono text-xl font-bold text-white">
          O
        </span>
        <span className="text-[15px] font-extrabold tracking-tight text-ink">
          ORKESTA OS
        </span>
      </div>
    </header>
  )
}
