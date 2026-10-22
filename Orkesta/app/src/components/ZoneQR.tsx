import { QRCodeSVG } from 'qrcode.react'
import type { ZoneStat } from '../lib/admin'

interface ZoneQRProps {
  zones: ZoneStat[]
}

// P5 — QR par zone/flyer. Scan → /?zone=CODE → Caisse pré-remplit la zone.
// Chaque flyer porte le QR de sa zone → mesure scan + zéro erreur saisie.
export default function ZoneQR({ zones }: ZoneQRProps) {
  const base = window.location.origin

  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text) } catch { /* clipboard indisponible — ignore */ }
  }

  return (
    <section>
      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink/50">QR par zone</h2>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {zones.map((z) => {
          const url = `${base}/?zone=${encodeURIComponent(z.code ?? z.name.split(' ')[0] ?? '')}`
          return (
            <div key={z.id} className="flex flex-col items-center gap-2 rounded-[28px] border border-ink/10 bg-white p-4">
              <span className="flex items-center gap-1.5 text-xs font-extrabold text-ink">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: z.color }} />
                {z.name}
              </span>
              <QRCodeSVG value={url} size={96} marginSize={0} />
              <button
                type="button"
                onClick={() => void copy(url)}
                className="tap w-full rounded-full bg-cream py-1.5 text-[11px] font-bold text-ink/70"
              >
                Copier lien
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}
