import { useState } from 'react'
import Modal from './Modal'
import { db } from '../lib/db'

interface PromoModalProps {
  restaurantId: string
  onClose: () => void
}

// + Nouvelle promo — BRIEF §4.3. Enregistre dans Dexie (offline).
export default function PromoModal({ restaurantId, onClose }: PromoModalProps) {
  const [name, setName] = useState('')
  const [pricePlace, setPricePlace] = useState('')
  const [priceDelivery, setPriceDelivery] = useState('')
  const [active, setActive] = useState(true)

  const valid = name.trim() && pricePlace.trim()

  async function save() {
    if (!valid) return
    await db.promos.add({
      id: crypto.randomUUID(),
      restaurantId,
      name: name.trim(),
      pricePlace: Number(pricePlace) || 0,
      priceDelivery: Number(priceDelivery) || Number(pricePlace) || 0,
      active,
    })
    onClose()
  }

  return (
    <Modal title="Nouvelle promo" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Nom promo">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Chimitanga de l’ouest" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Prix sur place €">
            <input className={inputCls} value={pricePlace} onChange={(e) => setPricePlace(e.target.value.replace(/[^\d.]/g, ''))} placeholder="50" inputMode="decimal" />
          </Field>
          <Field label="Prix livraison €">
            <input className={inputCls} value={priceDelivery} onChange={(e) => setPriceDelivery(e.target.value.replace(/[^\d.]/g, ''))} placeholder="55" inputMode="decimal" />
          </Field>
        </div>

        <label className="flex items-center justify-between rounded-2xl border border-ink/10 bg-white px-4 py-3">
          <span className="text-base font-semibold text-ink">Active</span>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-6 accent-[#FF4D00]" />
        </label>

        <button
          type="button"
          onClick={save}
          disabled={!valid}
          className="tap w-full rounded-[28px] bg-ink py-4 text-base font-extrabold text-white disabled:bg-mute disabled:text-ink/40"
        >
          Enregistrer promo
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
