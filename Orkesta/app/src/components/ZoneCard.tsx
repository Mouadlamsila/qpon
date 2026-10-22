import type { Zone } from '../lib/types'

interface ZoneCardProps {
  zone: Zone
  selected: boolean
  onSelect: (id: string) => void
}

// Couleur = repère (reconnaissance 0.3s). Déco circle = repère visuel, pas déco.
export default function ZoneCard({ zone, selected, onSelect }: ZoneCardProps) {
  const isLight = zone.color.toLowerCase() === '#f97316' // orange : texte sombre
  const fg = isLight ? 'text-ink' : 'text-white'

  return (
    <button
      type="button"
      onClick={() => onSelect(zone.id)}
      className={`tap relative flex min-h-24 flex-col justify-between overflow-hidden rounded-[28px] p-4 text-left ${fg} ${
        selected ? 'ring-[3px] ring-ink' : ''
      }`}
      style={{ backgroundColor: zone.color }}
      aria-pressed={selected}
    >
      {/* deco circle 15% — repère visuel rapide */}
      <span className="deco-circle" aria-hidden />

      <span className="relative text-[11px] font-semibold uppercase opacity-80">
        {zone.code}
      </span>
      <span className="relative text-base font-extrabold leading-tight">
        {zone.name}
      </span>

      {selected && (
        <span className="absolute right-3 top-3 grid size-6 place-items-center rounded-full bg-white text-ink">
          <CheckIcon />
        </span>
      )}
    </button>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 10.5 8 14.5 16 6" />
    </svg>
  )
}
