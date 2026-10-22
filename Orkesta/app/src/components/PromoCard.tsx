import type { Promo } from '../lib/types'

interface PromoCardProps {
  promo: Promo
  selected: boolean
  onSelect: (id: string) => void
}

// Badges = repères. Le prix masqué évite les hésitations du serveur.
export default function PromoCard({ promo, selected, onSelect }: PromoCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(promo.id)}
      disabled={!promo.active}
      className={`tap flex min-h-20 flex-col justify-between rounded-[28px] border bg-white p-4 text-left disabled:opacity-40 ${
        selected ? 'border-ink ring-[3px] ring-ink' : 'border-ink/10'
      }`}
      aria-pressed={selected}
    >
      <span className="flex items-start justify-between gap-2">
        <span className="text-[15px] font-extrabold leading-tight text-ink">
          {promo.name}
        </span>
        {selected && (
          <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-ink text-white">
            <svg viewBox="0 0 20 20" className="size-3" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 10.5 8 14.5 16 6" />
            </svg>
          </span>
        )}
      </span>

      <span className="mt-2 flex gap-1.5">
        <span className="rounded-full bg-mute px-2 py-0.5 text-[10px] font-bold uppercase text-ink/70">
          Prix masqué
        </span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${promo.active ? 'bg-flame text-white' : 'bg-mute text-ink/60'}`}>
          {promo.active ? 'Active' : 'Paused'}
        </span>
      </span>
    </button>
  )
}
