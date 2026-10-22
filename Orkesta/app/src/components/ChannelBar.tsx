import type { Channel } from '../lib/types'
import { CHANNELS } from '../lib/constants'

interface ChannelBarProps {
  selected: Channel | null
  onSelect: (c: Channel) => void
}

// 5 canaux. Sur place/Livraison = les 2 plus fréquents, donc en haut, gros.
export default function ChannelBar({ selected, onSelect }: ChannelBarProps) {
  const primary = CHANNELS.slice(0, 2)
  const secondary = CHANNELS.slice(2)

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {primary.map((c) => (
          <ChanBtn key={c.id} label={c.label} active={selected === c.id} big onClick={() => onSelect(c.id)} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {secondary.map((c) => (
          <ChanBtn key={c.id} label={c.label} active={selected === c.id} onClick={() => onSelect(c.id)} />
        ))}
      </div>
    </div>
  )
}

function ChanBtn({ label, active, onClick, big }: { label: string; active: boolean; onClick: () => void; big?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`tap rounded-[20px] border font-bold ${
        big ? 'py-4 text-base' : 'py-3 text-sm'
      } ${
        active
          ? 'border-ink bg-ink text-white'
          : 'border-ink/10 bg-white text-ink'
      }`}
    >
      {label}
    </button>
  )
}
