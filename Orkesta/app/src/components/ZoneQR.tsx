import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import type { ZoneStat } from '../lib/admin'

interface ZoneQRProps {
  zones: ZoneStat[]
}

// P5 — QR par zone/flyer. Scan → /?zone=CODE → Caisse pré-remplit la zone.
// Chaque flyer porte le QR de sa zone → mesure scan + zéro erreur saisie.
export default function ZoneQR({ zones }: ZoneQRProps) {
  const base = window.location.origin
  const [copiedId, setCopiedId] = useState<string | null>(null)

  async function copy(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1500)
    } catch { /* clipboard indisponible — ignore */ }
  }

  return (
    <section className="rounded-[28px] border border-ink/10 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-extrabold text-ink">QR par zone</h2>
          <p className="text-xs text-ink/45">Lien direct pré-rempli pour chaque flyer</p>
        </div>
        <span className="rounded-full bg-cream px-2.5 py-1 text-[11px] font-bold text-ink/60">
          {zones.length} zone{zones.length > 1 ? 's' : ''}
        </span>
      </div>
      {zones.length === 0 ? (
        <p className="py-6 text-center text-xs text-ink/40">Aucune zone</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {zones.map((z) => {
            const url = `${base}/?zone=${encodeURIComponent(z.code ?? z.name.split(' ')[0] ?? '')}`
            const copied = copiedId === z.id
            return (
              <div key={z.id} className="flex flex-col items-center gap-2.5 rounded-2xl border border-ink/10 bg-cream/40 p-3.5">
                <span className="flex items-center gap-1.5 text-xs font-extrabold text-ink">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: z.color }} />
                  <span className="truncate">{z.name}</span>
                </span>
                <div className="rounded-xl bg-white p-2 shadow-xs">
                  <QRCodeSVG value={url} size={88} marginSize={0} />
                </div>
                <button
                  type="button"
                  onClick={() => void copy(z.id, url)}
                  className={`tap w-full rounded-full py-1.5 text-[11px] font-bold transition-colors ${
                    copied ? 'bg-wa text-white' : 'bg-white text-ink/75 hover:text-ink'
                  }`}
                >
                  {copied ? '✓ Copié' : 'Copier lien'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
