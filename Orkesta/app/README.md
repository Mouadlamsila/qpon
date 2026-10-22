# Orkesta OS

Caisse rapide + suivi de campagnes flyers pour restaurants. **Product brief métier → `../BRIEF_ORKESTA.md`** · **Plan technique → `../PLAN_TECHNIQUE.md`**.

> From scratch (mchi fork d'un POS opensource) — le cœur = **attribution** (zone couleur → promo → canal → ROI), qui n'existe dans aucun projet existant.

## Stack

| Couche | Choix |
|---|---|
| UI | React 19 + Vite + **TypeScript strict** + **Tailwind v4** (tokens V5) |
| Offline | **Dexie.js** (IndexedDB) + PWA (vite-plugin-pwa) |
| Backend | **Supabase** — Postgres + Auth + **RLS** (restaurant_id isolation) |
| Tests | **Vitest** (12 tests : reports format + sync queue/idempotency) |

## Run (dev)

```bash
cd Orkesta/app
npm install
npm run dev          # → http://localhost:5173
```

**Clés** : copier `.env.example` → `.env`, remplir `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`.

## Comptes

| Rôle | Email / Mot de passe | Note |
|---|---|---|
| **Admin Foued** | `foued@orkesta.com` | PIN **2026** (UX) → puis login. Voir toutes les stats (RLS bypass). |
| **Tablette restaurant** | `crousty@orkesta.com` | Rôle `server_restaurant` lié à Crousty. **Connexion obligatoire** à `/` (AuthGate). Aucun accès admin (RLS tenant). |

> Mots de passe : **`app/CREDENTIALS.local.md`** (gitignored) — jamais dans le repo.
> Rotation : `node scripts/rotate-passwords.mjs` (met à jour Auth + `.env` + le fichier local).

> PIN 2026 = **UX seulement**. La vraie sécurité = Supabase Auth + RLS.
> La tablette n'a **pas** besoin des identifiants admin : son compte ne voit que son restaurant.
> Activation = une seule fois (la session persiste, même hors ligne).

## Routes (séparation nette)

| URL | Espace |
|---|---|
| **`/`** | Caisse — **login restaurant obligatoire** (AuthGate), aucun lien admin |
| **`/admin`** | Dashboard Foued — PIN 2026 → login Supabase **admin only** |
| **`/?zone=BLEU`** | Caisse (après login) avec zone pré-remplie — cible des QR flyers |

Pas de router externe : `history.pushState` + `usePath` (`src/lib/router.ts`). Netlify SPA fallback sert `index.html` pour `/admin`.
**Sécurité** : AuthGate = UX + tenant ; la vraie protection reste **Supabase Auth + RLS** (anon = 0 row). Un compte non-admin qui tente `/admin` est refusé.

## Sécurité — RLS (migration `0002_harden_rls.sql`)

| Acteur | orders / zones / promos | profiles | devices / campaigns |
|---|---|---|---|
| **anon** | aucun accès (0 row) | 0 row | 0 row |
| **restaurant** | SELECT + INSERT (jamais UPDATE/DELETE) | lire le sien | lire les siens |
| **admin** | tout | tout | tout |

- Orders : `zone_id` / `promo_id` doivent appartenir au **même** restaurant.
- `profiles` : écriture admin only → **impossible de s'auto-promouvoir** admin.
- Sync idempotente : `upsert(..., ignoreDuplicates)` = `ON CONFLICT DO NOTHING` → INSERT seul suffit.
- Vérif serveur : `node scripts/verify-rls.mjs` (**23 assertions**).

## Modes

- **Mode Caisse** (serveur restaurant) : login à `/` (une seule fois), puis 1 écran, < 2 sec — zone → promo → canal → ✓. Gros targets, couleur = repère, zéro clavier. Offline-first (badge ⏳). + nouvelle zone/promo, + tel optionnel (4 chiffres, RGPD), code promo (BLEU10 → pré-remplit). Login d'un autre restaurant = purge locale + pull de son tenant.
- **Mode Admin** (Foued) : PIN + login → dashboard (6 KPI), table par zone, dernières commandes, **Export CSV**, **Résumé WhatsApp** (format 📦✅📈💰), **QR par zone**.

## Architecture

```
src/lib/
  types.ts      # Zone, Promo, Order, Channel...
  constants.ts  # 5 canaux, couleurs zones, THEME V5, ADMIN_PIN
  db.ts         # Dexie schema + wipeLocal() (révocation)
  supabase.ts   # client (optionnel — app tournée offline sans)
  store.ts      # live queries (Zones/Promos/Orders) + recordOrder
  sync.ts       # P2 : pushOrders (upsert idempotent) + pullReference + engine
  admin.ts      # P3 : loadDashboard, signIn/isAdmin (RLS)
  reports.ts    # P4 : WhatsApp summary (format exact), CSV, wa.me
  seed.ts       # démo offline (org + 3 zones + 5 promos)
supabase/migrations/0001_init.sql   # 7 tables + RLS + idempotency
scripts/        # migrate, seed, verify, create/link-admin, tests
tests/          # vitest (reports + sync)
```

### Sync offline-first (P2)
1. Écriture locale → `pendingOrders` (status=pending), `client_uuid` = idempotency key.
2. Engine (15s + online + visibilitychange) → **PUSH** (upsert `onConflict:id`, drain) → **PULL** (orgs/zones/promos remplacent le cache, server wins).
3. Offline → skip silencieux. Push échec → status=error (pas de retry infini).

### Sécurité / multi-tenant
- Chaque table porte `restaurant_id` + **RLS** : `restaurant_id = me_org()` OU `is_admin()`.
- `anon` sans auth → **0 row** (vérifié). Admin `admin_foued` → bypass (dashboard multi-restaurants).
- Révocation tablette = `SIGNED_OUT` → `wipeLocal()` (BRIEF §8 : collaboration stoppée → vidée).

## Tests + scripts

```bash
npm test                      # vitest : reports + sync (12 tests)
npm run seed                  # seed démo Supabase (idempotent)
node scripts/verify.mjs       # stats + RLS anon=[]
node scripts/verify-admin.mjs # admin login → data visible
node scripts/test-idempotency.mjs  # double-push → 1 row
node scripts/test-logins.mjs  # login admin + tablette (RLS)
node scripts/signup-restaurant.mjs + finish-restaurant-user.mjs  # compte tablette
```

## Deploy

**Netlify** : `netlify.toml` fourni (build `npm run build` → `dist`, SPA fallback). Connecter le repo → auto-deploy. PWA installable (manifest + service worker auto).

## Production (ops)

- **Révocation d'une tablette** : supprimer/bannir le compte `server_restaurant` dans Supabase → Authentication. Le refresh échoue → `SIGNED_OUT` → `wipeLocal()` (BRIEF §8). (Granularité = compte restaurant, pas appareil : la table `devices` reste à brancher si besoin.)
- **Backup** : Supabase free tier n'inclut pas de backups auto (pause après 7j d'inactivité). Export manuel : `Export CSV` (admin) + dump SQL `pg_dump "$DB_URL" > backup.sql`.
- **Clés** : `.env` jamais commité. Rotation de l'anon key = redéployer le front.
- **Comptes** : 1 compte `server_restaurant` par restaurant (script `signup-restaurant.mjs` + `finish-restaurant-user.mjs`).

## Status

- ✅ P0 fondations · P1 caisse UI · Backend RLS · P2 sync (idempotency ✓) · P3 admin · P4 reports · P5 V2 (QR + code promo) · P6 (wipe + 12 tests + deploy)
- ✅ Fixes backend : PIN ne donne plus l'admin sans session · push row-par-row (une erreur ne bloque plus le lot) · zones/promos créés offline poussés avant les orders · CSV = **toutes** les commandes (paginated) · WhatsApp = nom réel du resto + filtre période · commandes en erreur **visibles** (bandeau + retry) · compte tablette restaurant (sync sans login admin)
- ⚠️ Non vérifié : flux Dexie→Supabase E2E en navigateur réel (offline/online sim via DevTools throttle) — code testé unit + idempotency prouvée au niveau DB.
