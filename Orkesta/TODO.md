# Orkesta — TODO

Exécution continue. Update status mli kol phase tkml.

## ✅ Done
- [x] **P0** Foundations — Vite+React+TS strict, Tailwind v4 tokens V5, PWA, Dexie schema, Supabase client
- [x] **P1** Caisse UI pixel-perfect — Header toggle, client selector, ZoneCard, PromoCard, ChannelBar, modals (zone/promo), +Tel, toast, dernières commandes
- [x] **Backend** Supabase — 7 tables, RLS restaurant_id isolation, admin bypass, idempotency (orders PK=client_uuid)
- [x] **P3** Admin — PIN 2026 + Supabase Auth + dashboard (6 KPI + table par zone + dernières commandes). Verified: admin RLS bypass → 5 orders/3 zones visible
- [x] **P2** Sync — sync.ts (push idempotent upsert, pull server-wins, engine interval/online/visibility), badge ⏳, idempotency test → 1 row (no dup)
- [x] **P4** Reports — reports.ts (WhatsApp exact format 📦✅📈💰, wa.me share, CSV+BOM Excel), Admin buttons Export CSV / Résumé WhatsApp
- [x] **P5** V2 — Caisse code promo (BLEU10 → pré-remplit zone, match préfixe) + URL ?zone= pre-fill (QR scan) + Admin ZoneQR (QRCodeSVG per zone, copier lien)
- [x] **P6** Hardening — wipeLocal() on SIGNED_OUT (§8 révocation), vitest **9 tests** (reports format + sync queue/idempotency), netlify.toml (SPA fallback), README.md
- [x] **Responsive** UI — `.page-width` shell (phone 28rem → tablet 56rem → desktop 68rem), grids multi-col `md:` (zones/promos 4-col, KPI 3-col, recent 2-col), save button/toast/header alignés. Phone = identique.
- [x] **Backend audit + fixes** — PIN ne donne plus l'admin sans session · push row-par-row · pushReference (zones/promos offline) · CSV toutes commandes paginé · WhatsApp nom réel + période · erreurs sync visibles + retry · compte tablette `crousty@orkesta.com` (role server_restaurant) + activation in-app
- [x] **Auth gate `/`** — login restaurant obligatoire, redirection admin `/admin`, séparation tenant (wipe + pull si autre org), rôle vérifié sur `/admin`
- [x] **RLS durci** `0002_harden_rls.sql` — restaurant = SELECT+INSERT only, admin = tout, anti-escalade profiles, orders liés aux zones/promos du même org
- [x] **Rotation passwords** — bcrypt 10, `.env` + `CREDENTIALS.local.md` (gitignored), script `rotate-passwords.mjs`
- [x] **Vérif RLS** — `verify-rls.mjs` : 23 assertions (anon 0 row, isolation, anti-delete, anti-escalade)

## ⏳ Reste (production)
- [ ] Vérif E2E navigateur (offline→online) après fix — checklist `TEST_MANUEL.md`
- [ ] Révocation à distance via table `devices`
- [ ] Backup/restore Supabase + plan free tier
- [ ] Déploiement Netlify réel (config prête)

## ⚠️ Not verified (honest)
- Full Dexie→Supabase browser E2E (offline/online sim) — khtaj DevTools throttle f `npm start`
