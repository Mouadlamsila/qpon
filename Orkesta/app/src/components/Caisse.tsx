import { useEffect, useState } from 'react'
import type { Channel, Organization } from '../lib/types'
import { recordOrder, useOrgs, usePromos, useRecentOrders, useZones } from '../lib/store'
import { supabase } from '../lib/supabase'
import { usePendingCount, useErrors, retryErrors, discardErrors } from '../lib/sync'
import ZoneCard from './ZoneCard'
import PromoCard from './PromoCard'
import ChannelBar from './ChannelBar'
import ZoneModal from './ZoneModal'
import PromoModal from './PromoModal'

// Mode Caisse — 1 écran, < 2 sec, Meta-inspired (peu de boutons, gros targets).
export default function Caisse() {
  const orgs = useOrgs()
  const [orgId, setOrgId] = useState<string | null>(null)
  const activeOrg = orgs.find((o) => o.id === orgId) ?? orgs[0] ?? null
  const rid = activeOrg?.id ?? null
  const pending = usePendingCount()
  const syncErrors = useErrors()

  const zones = useZones(rid)
  const promos = usePromos(rid)
  const recent = useRecentOrders(rid)

  const [zoneId, setZoneId] = useState<string | null>(null)
  const [promoId, setPromoId] = useState<string | null>(null)
  const [channel, setChannel] = useState<Channel | null>(null)
  const [saved, setSaved] = useState(false)
  const [showZoneModal, setShowZoneModal] = useState(false)
  const [showPromoModal, setShowPromoModal] = useState(false)
  const [telOpen, setTelOpen] = useState(false)
  const [tel, setTel] = useState('')
  const [code, setCode] = useState('')
  const [codeMsg, setCodeMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const ready = Boolean(zoneId && promoId && channel)

  // P5 — code promo unique par zone (ex: BLEU10 → pré-remplit zone BLEU).
  // Le code commence par le code zone. Match case-insensitive sur préfixe.
  function applyCode(raw: string) {
    const c = raw.trim().toUpperCase()
    if (!c) return
    const match = zones.find((z) => c.startsWith(z.code.toUpperCase()))
    if (match) {
      setZoneId(match.id)
      setCodeMsg({ ok: true, text: `Zone ${match.name} sélectionnée` })
      setCode('')
    } else {
      setCodeMsg({ ok: false, text: `Code "${c}" inconnu` })
    }
    setTimeout(() => setCodeMsg(null), 2200)
  }

  // P5 — QR scan → URL ?zone=CODE → pré-remplit zone au mount.
  useEffect(() => {
    const z = new URLSearchParams(window.location.search).get('zone')
    if (!z || zones.length === 0) return
    const match = zones.find((x) => x.code.toUpperCase() === z.toUpperCase())
    if (match) setZoneId(match.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zones])

  async function save() {
    if (!ready || !rid || !zoneId || !promoId || !channel) return
    const promo = promos.find((p) => p.id === promoId)
    const amount = channel === 'LIVRAISON' ? promo?.priceDelivery ?? 0 : promo?.pricePlace ?? 0

    await recordOrder({
      id: crypto.randomUUID(), // client_uuid = idempotency key
      restaurantId: rid,
      zoneId,
      promoId,
      channel,
      amount,
      clientLast4: tel.slice(-4) || null, // RGPD : 4 chiffres, optionnel
      createdAt: Date.now(),
    })

    // Reset pour client suivant — feedback immédiat.
    setZoneId(null)
    setPromoId(null)
    setChannel(null)
    setTel('')
    setTelOpen(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  return (
    <main className="page-width px-4 pb-28 pt-4">
      <ClientSelector orgs={orgs} active={activeOrg} onSelect={(o) => setOrgId(o.id)} />

      {/* Erreurs de sync = jamais silencieux (FK/RLS) */}
      {syncErrors.length > 0 && (
        <div className="mb-3 rounded-2xl border border-flame/30 bg-flame/10 p-3">
          <p className="text-xs font-bold text-flame">
            ⚠️ {syncErrors.length} commande{syncErrors.length > 1 ? 's' : ''} non synchronisée{syncErrors.length > 1 ? 's' : ''}
          </p>
          <p className="mt-1 break-words font-mono text-[10px] leading-snug text-flame/80">
            {syncErrors[0]?.lastError ?? 'raison inconnue'}
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => void retryErrors()}
              className="tap flex-1 rounded-full bg-flame py-2 text-[11px] font-bold text-white"
            >
              Réessayer
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Supprimer ${syncErrors.length} commande(s) non synchronisée(s) ? Définitif.`)) void discardErrors()
              }}
              className="tap flex-1 rounded-full border border-flame/30 py-2 text-[11px] font-bold text-flame"
            >
              Supprimer
            </button>
          </div>
        </div>
      )}

      {/* Sync status — badge ⏳ silencieux (offline = jamais erreur bloquante) */}
      {pending > 0 && (
        <p className="mb-3 flex items-center justify-center gap-1.5 rounded-full bg-ink/5 px-3 py-1.5 text-center text-xs font-semibold text-ink/60">
          ⏳ {pending} commande{pending > 1 ? 's' : ''} en attente de sync
        </p>
      )}

      <Section title="Zone">
        {/* P5 — code promo unique par zone (BLEU10 → pré-remplit BLEU) */}
        <form
          onSubmit={(e) => { e.preventDefault(); applyCode(code) }}
          className="mb-2 flex gap-2"
        >
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Code promo (ex: BLEU10)"
            autoCapitalize="characters"
            autoComplete="off"
            className="min-w-0 flex-1 rounded-2xl border border-ink/10 bg-white px-4 py-2.5 text-base font-bold uppercase tracking-wide text-ink placeholder:normal-case placeholder:font-medium placeholder:text-ink/30 focus:border-ink focus:outline-none"
          />
          <button type="submit" className="tap shrink-0 rounded-2xl bg-ink px-4 text-sm font-bold text-white">
            OK
          </button>
        </form>
        {codeMsg && (
          <p className={`mb-2 text-center text-xs font-semibold ${codeMsg.ok ? 'text-wa' : 'text-flame'}`}>
            {codeMsg.ok ? '✓ ' : '✗ '}{codeMsg.text}
          </p>
        )}
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {zones.map((z) => (
            <ZoneCard key={z.id} zone={z} selected={z.id === zoneId} onSelect={setZoneId} />
          ))}
          <AddCard label="Nouvelle zone" onClick={() => setShowZoneModal(true)} />
        </div>
      </Section>

      <Section title="Promo">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {promos.map((p) => (
            <PromoCard key={p.id} promo={p} selected={p.id === promoId} onSelect={setPromoId} />
          ))}
          <AddCard label="Nouvelle promo" onClick={() => setShowPromoModal(true)} />
        </div>
      </Section>

      <Section title="Canal">
        <ChannelBar selected={channel} onSelect={setChannel} />
      </Section>

      {/* + Tel optionnel — 4 chiffres, tap tardif, masqué par défaut (RGPD) */}
      {telOpen ? (
        <div className="mb-3 flex items-center gap-2 rounded-2xl border border-ink/10 bg-white px-4 py-3">
          <span className="text-sm font-semibold text-ink/60">+ Tel</span>
          <input
            className="w-full bg-transparent font-mono text-base font-bold text-ink placeholder:text-ink/30 focus:outline-none"
            value={tel}
            onChange={(e) => setTel(e.target.value.replace(/\D/g, ''))}
            placeholder="4 chiffres"
            inputMode="numeric"
            maxLength={4}
            autoFocus
          />
          <button type="button" onClick={() => { setTel(''); setTelOpen(false) }} className="text-ink/40" aria-label="Annuler tel">✕</button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setTelOpen(true)}
          className="tap mb-3 w-full rounded-2xl border border-dashed border-ink/20 py-2.5 text-sm font-bold text-ink/50"
        >
          + Tel (optionnel)
        </button>
      )}

      <button
        type="button"
        onClick={save}
        disabled={!ready}
        className="tap fixed inset-x-0 bottom-0 page-width rounded-t-[28px] bg-wa py-5 text-lg font-extrabold text-white disabled:bg-mute disabled:text-ink/40"
      >
        {ready ? '✓ Enregistrer' : 'Choisis zone, promo, canal'}
      </button>

      {saved && <Toast />}

      {showZoneModal && rid && <ZoneModal restaurantId={rid} onClose={() => setShowZoneModal(false)} />}
      {showPromoModal && rid && <PromoModal restaurantId={rid} onClose={() => setShowPromoModal(false)} />}

      <Section title="Dernières commandes">
        {recent.length === 0 ? (
          <p className="rounded-[28px] border border-dashed border-ink/15 p-4 text-center text-sm text-ink/40">
            Aucune commande pour l’instant
          </p>
        ) : (
          <ul className="space-y-1.5 md:grid md:grid-cols-2 md:gap-1.5 md:space-y-0">
            {recent.map((o) => {
              const z = zones.find((x) => x.id === o.zoneId)
              const p = promos.find((x) => x.id === o.promoId)
              return (
                <li key={o.id} className="flex items-center gap-2 rounded-2xl border border-ink/10 bg-white px-3 py-2.5 text-sm">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: z?.color ?? '#999' }} />
                  <span className="min-w-0 flex-1 truncate font-semibold text-ink">{p?.name ?? '—'}</span>
                  <span className="shrink-0 rounded-full bg-cream px-2 py-0.5 text-[10px] font-bold uppercase text-ink/60">{o.channel}</span>
                  <span className="shrink-0 font-mono text-xs font-bold text-ink">{o.amount}€</span>
                </li>
              )
            })}
          </ul>
        )}
      </Section>

      {/* Changer de restaurant/tablette : sign-out → wipe (App) → AuthGate login */}
      {supabase && (
        <button
          type="button"
          onClick={() => {
            if (pending > 0 && !window.confirm(`${pending} commande(s) pas encore synchronisée(s). Changer de compte quand même ?`)) return
            void supabase?.auth.signOut()
          }}
          className="mt-2 w-full py-3 text-center text-[11px] font-semibold text-ink/30"
        >
          Changer de compte
        </button>
      )}
    </main>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink/50">{title}</h2>
      {children}
    </section>
  )
}

// Carte pointillée "+" — création à la volée depuis la caisse.
function AddCard({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tap flex min-h-20 flex-col items-center justify-center gap-1 rounded-[28px] border-2 border-dashed border-ink/20 text-ink/50"
    >
      <span className="text-2xl leading-none">+</span>
      <span className="text-xs font-bold">{label}</span>
    </button>
  )
}

function ClientSelector({ orgs, active, onSelect }: { orgs: Organization[]; active: Organization | null; onSelect: (o: Organization) => void }) {
  return (
    <label className="mb-5 flex items-center gap-3 rounded-[28px] border border-ink/10 bg-white p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-cream text-ink">🏪</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-bold uppercase text-ink/50">Choisis client</span>
        <span className="block truncate text-base font-extrabold text-ink">{active?.name ?? '—'}</span>
      </span>
      {orgs.length > 1 && (
        <select
          className="max-w-24 shrink-0 rounded-full border border-ink/15 bg-cream px-2 py-1.5 text-sm font-bold"
          value={active?.id ?? ''}
          onChange={(e) => {
            const o = orgs.find((x) => x.id === e.target.value)
            if (o) onSelect(o)
          }}
        >
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      )}
    </label>
  )
}

function Toast() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 page-width px-4">
      <div className="rounded-[28px] bg-ink px-5 py-4 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-wa text-lg">✓</span>
          <div>
            <p className="text-base font-extrabold">Commande enregistrée</p>
            <p className="text-sm text-white/60">Prêt pour le client suivant</p>
          </div>
        </div>
      </div>
    </div>
  )
}
