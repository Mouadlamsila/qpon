import { useState } from 'react'
import Modal from './Modal'
import { db } from '../lib/db'
import { ZONE_COLORS } from '../lib/constants'

interface ZoneModalProps {
  restaurantId: string
  onClose: () => void
}

const PRESETS = [
  { key: 'blue', label: 'Bleu' },
  { key: 'green', label: 'Vert' },
  { key: 'black', label: 'Noir' },
  { key: 'orange', label: 'Orange' },
] as const

// + Nouvelle zone — BRIEF §4.2. Enregistre dans Dexie (offline).
export default function ZoneModal({ restaurantId, onClose }: ZoneModalProps) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [flyers, setFlyers] = useState('')
  const [colorKey, setColorKey] = useState<keyof typeof ZONE_COLORS>('blue')

  const color = ZONE_COLORS[colorKey]
  const valid = name.trim() && code.trim()

  async function save() {
    if (!valid) return
    await db.zones.add({
      id: crypto.randomUUID(),
      restaurantId,
      name: name.trim(),
      code: code.trim().toUpperCase(),
      color,
      flyersDistributed: Number(flyers) || 0,
    })
    onClose()
  }

  return (
    <Modal title="Nouvelle zone" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Nom zone">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="BLEU Centre" />
        </Field>

        <Field label="Code">
          <input className={inputCls} value={code} onChange={(e) => setCode(e.target.value)} placeholder="BLEU" maxLength={6} />
        </Field>

        <Field label="Distribués (flyers)">
          <input className={inputCls} value={flyers} onChange={(e) => setFlyers(e.target.value.replace(/\D/g, ''))} placeholder="200" inputMode="numeric" />
        </Field>

        <Field label="Couleur">
          <div className="flex gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setColorKey(p.key)}
                className={`tap size-11 rounded-full ${colorKey === p.key ? 'ring-[3px] ring-ink' : ''}`}
                style={{ backgroundColor: ZONE_COLORS[p.key] }}
                aria-label={p.label}
              />
            ))}
          </div>
        </Field>

        {/* Aperçu — le serveur reconnaît la zone par la couleur */}
        <Field label="Aperçu">
          <div className="relative flex min-h-20 items-end overflow-hidden rounded-[28px] p-4" style={{ backgroundColor: color }}>
            <span className="deco-circle" aria-hidden />
            <span className="relative text-base font-extrabold text-white">{name || 'Nom zone'}</span>
          </div>
        </Field>

        <button
          type="button"
          onClick={save}
          disabled={!valid}
          className="tap w-full rounded-[28px] bg-ink py-4 text-base font-extrabold text-white disabled:bg-mute disabled:text-ink/40"
        >
          Enregistrer zone
        </button>
      </div>
    </Modal>
  )
}

const inputCls =
  'w-full rounded-2xl border border-ink/10 bg-white px-4 py-3 text-base font-semibold text-ink placeholder:text-ink/30 focus:border-ink focus:outline-none'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ink/50">{label}</span>
      {children}
    </label>
  )
}
