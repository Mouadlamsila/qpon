# Orkesta — TODO

Exécution continue. Update status mli kol phase tkml.

## ✅ Done
- [x] **P0** Foundations — Vite+React+TS strict, Tailwind v4 tokens V5, PWA, Dexie schema, Supabase client
- [x] **P1** Caisse UI pixel-perfect — Header, client selector, ZoneCard, PromoCard, ChannelBar, modals (zone/promo), +Tel, toast détaillé, dernières commandes
- [x] **Backend** Supabase — 7 tables, RLS restaurant_id isolation, admin bypass, idempotency (orders PK=client_uuid)
- [x] **P3** Admin — PIN 2026 + Supabase Auth + dashboard. Vérifié: admin RLS bypass visible
- [x] **P2** Sync — push idempotent, pull server-wins, engine interval/online/visibility, badge ⏳, idempotency test → 1 row
- [x] **P4** Reports — WhatsApp (KPI + coût/ROI/panier/comparaison), wa.me, CSV paginé + BOM Excel
- [x] **P5** V2 — Code promo caisse + URL `?zone=` (QR) + Admin ZoneQR
- [x] **P6** Hardening — wipeLocal() sur SIGNED_OUT, vitest, netlify.toml (SPA fallback), README
- [x] **Responsive** UI — `.page-width` phone → tablet → desktop, grids multi-col
- [x] **Backend audit + fixes** — PIN ≠ admin sans session · push row-par-row · pushReference · CSV complet · WhatsApp nom réel · erreurs sync visibles + retry · compte tablette restaurant
- [x] **Auth gate `/`** — login restaurant obligatoire, redirection admin, séparation tenant (wipe + pull), rôle vérifié `/admin`
- [x] **RLS durci** `0002_harden_rls.sql` — restaurant = SELECT+INSERT only, admin = tout, anti-escalade profiles, orders liés au même org
- [x] **Rotation passwords** — bcrypt 10, `.env` + `CREDENTIALS.local.md` gitignored
- [x] **Vérif RLS** — `verify-rls.mjs` : 23 assertions
- [x] **P0 multi-restaurant** — sélecteur admin « Tous clients »/précis, `orgName` réel, `restaurant_id`/nom dans commandes récentes + CSV, classement clients
- [x] **P1 dashboard** — périodes jour/semaine/mois/tout + comparaison période précédente · CA Sur place/Livraison/Uber/Takeaway/Appli + panier moyen · table promo (used/CA, activer/désactiver) · flyers distribués éditables (taux recalculé) · dernières commandes détaillées (heure/resto/zone/promo/canal) · auto-refresh 30 s
- [x] **P2 ROI** — coût campagne (saisie admin) → coût/commande + ROI · top zones · panier moyen · aperçu WhatsApp (copier/ouvrir)
- [x] **Ajout restaurant** — UI `+ Restaurant` via RPC SQL `admin_create_restaurant` (security definer, admin-only, anon interdit) + fallback `scripts/add-restaurant.mjs`
- [x] **Admin clair** — header + dashboard beige (retour demandé par Foued), cartes blanches, accents orange
- [x] **Historique caisse** — table Dexie `orders` (survit à la sync) + pull des 50 dernières commandes serveur
- [x] **Lock caisse** — bouton haut droite (à côté du client), confirmation si pending/erreur, sign-out → wipe local
- [x] **Tests** — `tsc` ✓ · vitest **19/19** ✓ · build ✓ · `verify-dashboard.mjs` (filtre + embed CSV + prev) ✓ · `test-multi.mjs` (admin 2 orgs / tenant 1 org / filtre) ✓

## ⏳ Reste
### Code (P1/P2 restants)
- [ ] Édition/suppression **zones** (nom/code/couleur) — suppression bloquée par FK si commandes
- [ ] Édition **promos** (nom/prix) — actuellement activer/désactiver seulement
- [ ] « Reset jour » — sémantique à confirmer avec Foued (reset flyers ? compteurs ?)
- [ ] V2 : carte zones, tracking scans QR, clients récurrents, test A/B promos
- [ ] Dashboard plafonné à 1000 commandes (PostgREST) — paginer si volume supérieur

### Production
- [ ] Vérif E2E navigateur (offline→online, toast, dashboard) — checklist `TEST_MANUEL.md`
- [ ] Supprimer les 2 commandes locales `status=error` (FK seed) via l'UI
- [ ] Révocation à distance via table `devices`
- [ ] Backup/restore Supabase + plan free tier
- [ ] Déploiement Netlify réel (config prête)
- [ ] Pousser les commits locaux

## ⚠️ Not verified (honest)
- Full Dexie→Supabase browser E2E (offline/online sim) — khtaj DevTools throttle f `npm start`
- Rendu visuel admin non testé sur device réel (tsc/build ✓)
- RPC onboarding + isolation multi-tenant : testées end-to-end (`scripts/test-multi.mjs`) ✓
