# ORKESTA OS — Plan Technique

> Suite à `BRIEF_ORKESTA.md` (vision métier). Ce document décrit **comment** construire le produit.
> **Décision : from scratch.** Aucun projet open-source existant ne couvre le modèle d'attribution
> (zone couleur → promo → canal → ROI). On réutilise uniquement des **libs standard** et des **concepts**
> (offline queue, idempotency), pas de fork de projet POS générique.

---

## 1. Stack (validée)

| Couche | Choix | Raison |
|---|---|---|
| **UI** | **React 19 + Vite + TypeScript (strict)** | Rapide, type-safe, PWA-ready |
| **Design** | **Tailwind CSS** (pas Bootstrap) | V5 = radius 28px + couleurs custom (#FF4D00, #FEF9EC). Tailwind = utility classes → **pixel-perfect** sans override. Bootstrap imposerait son look par défaut. |
| **Offline** | **Dexie.js** (IndexedDB) | File d'attente + stockage local des commandes |
| **DB** | **PostgreSQL via Supabase** | Choix confirmé |
| **Backend/Auth/RLS** | **Supabase** ✅ (validé) | Postgres managed + Auth + **RLS natif** + Realtime. **Least code**, fastest result. |

### 2. Backend — **Supabase ✅ (validé)**

**Supabase = Postgres managed + Auth + Row Level Security + Realtime + Storage.**
- **Moins de code** : auth email/password + RLS natif en SQL → pas de serveur d'autorisation custom
- **Sync idempotente** via Postgres function (RPC) ou Edge Function
- **Realtime** pour le dashboard admin (stats live sans polling)
- **PWA pairing** via device table + RLS
- *Inconvénient* : vendor lock-in partiel (atténué : c'est du Postgres standard, exportable)

> **Décision finale :** objectif = **livrer vite** → **Supabase**. Contrôle = RLS SQL + Edge Functions.
> Le code reste portable (Postgres standard, requêtes SQL classiques).

---

## 2. UI/UX Design — Simple, Meta-inspired, pour serveurs pressés

> **Contrainte client :** les utilisateurs = **serveurs de restaurant, non-tech, pas de temps**.
> Objectif : **une commande en < 2 sec**, yeux 3la écran, mains grasses, 0 réflexion.
> Inspiration : **Facebook/Meta mobile** — feed simple, gros targets, peu de boutons, feedback immédiat.

### Principes (non négociables)

1. **Une action = un écran** → pas de menu, pas de sidebar, pas de navigation complexe.
   Le serveur **voit tout** d'un coup d'œil : client → zone → promo → canal.
2. **Gros targets tactiles** → zones/promos = **cards pleine largeur**, min 64px height.
   Jamais de petit menu déroulant pour zone/promo. **Tap = select.**
3. **Peu de boutons** → 3-4 choix max par étape. Pas de "Modifier/Supprimer/Options"
   sur l'écran de caisse (masqués dans le Mode Admin uniquement).
4. **Couleur = repère** (pas texte) → le serveur reconnaît la zone en **0.3s** par la
   couleur (bleu/vert/noir), pas en lisant. `#2563EB`, `#16A34A`, `#0F0F0F`.
5. **Feedback immédiat** → tap = bordure noire + coche (style Facebook "selected").
   Commande enregistrée = popup verte + son + vibration. Pas de spinner long.
6. **Zéro saisie clavier** → pas de champ texte en caisse. Tout = tap.
   (Le `+ Tel` optionnel = seul champ, tap tardif, masqué par défaut.)
7. **Offline silencieux** → si pas de réseau, la commande passe quand même
   (badge discret "⏳ en attente"). **Jamais** de message d'erreur bloquant.
8. **Typography trapue, lisible** → Geist/Inter, taille généreuse (18-22px),
   contraste fort (noir sur beige). Lisible à bras longs sur tablette.
9. **Mode Caisse = fond clair** (`#FEF9EC`), **Mode Admin = fond sombre** (`#111`).
   Le serveur sait toujours dans quel mode il est par la couleur de fond.

### Layout Caisse (Meta-feed style)

```
┌──────────────────────────────┐
│  ORKESTA OS    [MODE CAISSE] │  ← header fixe, toggle
├──────────────────────────────┤
│  🏪 CROUSTY VERVIERS    ▼   │  ← client (verrouillé, tap si multi)
├──────────────────────────────┤
│  ZONE                       │
│  ┌────────┐ ┌────────┐      │  ← cards pleine largeur, 2 colonnes
│  │BLEU    │ │VERT    │      │     max, couleur = repère
│  │Centre  │ │Hodimont│      │
│  └────────┘ └────────┘      │
│  ┌────────┐ ┌────────┐      │
│  │MALMEDY │ │ + NEW  │      │
│  └────────┘ └────────┘      │
├──────────────────────────────┤
│  PROMO                      │
│  ┌────────┐ ┌────────┐      │  ← mêmes cards
│  │Chimita-│ │Lili la │      │
│  │nga     │ │dinde   │      │
│  └────────┘ └────────┘      │
├──────────────────────────────┤
│  CANAL                      │
│  [SUR PLACE] [LIVRAISON]    │  ← 2 boutons gros
│  [UBER] [TAKEAWAY] [APPLI] │
├──────────────────────────────┤
│      ✅ ENREGISTRER          │  ← CTA plein écran, vert
└──────────────────────────────┘
```

**Flux :** tap zone → tap promo → tap canal → **auto-confirm** (ou tap ENREGISTRER).
Popup `Commande enregistrée` → reset écran → prêt pour client suivant. **< 2 sec.**

### Comparaison Meta
- **Comme Facebook** : gros avatars/cards, couleurs vives, tap = action, feed vertical,
  peu de chrome UI, feedback instantané (like = coche bleue).
- **Pas comme** : dashboard admin dense (stats, tables, filtres) → **réservé Mode Admin**,
  jamais montré au serveur.

### Accessibilité
- Contraste WCAG AA (noir sur beige = fort)
- Targets ≥ 48px (Google) / 64px (reco)
- Haptic feedback (vibration) sur sélection
- Icônes **+** texte (jamais icône seule ambiguë)

---

## 3. Architecture

```
┌─────────────────────────────────────────────────┐
│  TABLETTE RESTAURANT (Mode Caisse) — PWA       │
│  React + Tailwind + Dexie (offline queue)      │
│  Verrouillée 1 restaurant, PIN UX 2026         │
└───────────────────┬─────────────────────────────┘
                    │ sync (idempotent)
                    ▼
┌─────────────────────────────────────────────────┐
│  BACKEND (Supabase OU NestJS)                  │
│  Auth + RLS (restaurant_id) + API sync         │
└───────────────────┬─────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│  PostgreSQL (multi-tenant, restaurant_id)      │
└─────────────────────────────────────────────────┘
                    ▲
                    │ lecture (admin)
┌─────────────────────────────────────────────────┐
│  ADMIN FOUED (dashboard, stats, rapports)      │
│  PIN 2026 + role admin, accès toutes tenants   │
└─────────────────────────────────────────────────┘
```

---

## 4. Modèle de données (Postgres)

> Chaque table métier porte **`restaurant_id`** (isolation multi-tenant) + `created_at`, `updated_at`.

- **`organizations`** — id, name (Crousty Verviers), created_at
- **`users`** — id, email, password_hash, role (`admin_foued` | `server_restaurant`), organization_id (nullable pour Foued)
- **`devices`** — id, restaurant_id, pairing_code, status (`active` | `revoked`), last_seen
- **`zones`** — id, restaurant_id, name (BLEU Centre), code (BLEU), color (#2563EB), flyers_distributed (500)
- **`promos`** — id, restaurant_id, name (Chimitanga), price_place, price_delivery, status (active/paused)
- **`channels`** — enum: `SUR_PLACE`, `LIVRAISON`, `UBER`, `TAKEAWAY`, `APPLI`
- **`orders`** — id, restaurant_id, zone_id, promo_id, channel, client_last4 (nullable, RGPD), amount, created_at, **client_uuid** (idempotency), synced_at
- **`campaigns`** — id, restaurant_id, name, cost, start_date, end_date (pour ROI)

**Index** : `orders(restaurant_id, created_at)`, `orders(client_uuid)` UNIQUE (idempotency).

**RLS** :
```sql
-- Restaurant ne voit QUE ses données
CREATE POLICY tenant_isolation ON orders
  FOR ALL USING (restaurant_id = current_setting('app.current_org')::uuid);
-- Foued (admin) bypass
```

---

## 5. Sync Offline-First (Dexie → Server)

1. **Écriture locale** (Dexie) : commande → table `pending_orders` avec `client_uuid` (UUID généré côté client) + `status: 'pending'`
2. **Background sync** : `navigator.onLine` + `visibilitychange` → POST batch vers `/sync/orders`
3. **Idempotency** : le serveur reçoit `client_uuid` → si déjà existant, **ignore** (UNIQUE constraint). Pas de doublon.
4. **Réconciliation** : pull des zones/promos/clients mis à jour → Dexie
5. **Gestion conflit** : server = source of truth. Dernier write gagne sur `updated_at`.

---

## 6. Phases de livraison

### **P0 — Fondations** (semaine 1)
- [ ] Vite + React + TS strict + Tailwind + PWA (vite-plugin-pwa)
- [ ] Structure dossiers (`/caisse`, `/admin`, `/components`, `/lib`)
- [ ] Dexie schema (zones, promos, orders, pending_orders)
- [ ] Supabase **ou** NestJS scaffold + auth email/password
- [ ] RLS `restaurant_id` (ou middleware NestJS)
- [ ] Device pairing (QR/setup code, verrouillage 1 restaurant)

### **P1 — Caisse UI (pixel-perfect V5)** (semaine 2)
- [ ] Header `ORKESTA OS` + toggle `MODE CAISSE` / `MODE ADMIN`
- [ ] `CHOISIS CLIENT` (dropdown, verrouillage)
- [ ] Cards `ZONES` (couleur, code, deco circle, selected = bord 3px + check, `+ Nouvelle zone` modal)
- [ ] Cards `PROMOS` (badges PRIX MASQUÉ/ACTIVE, `+ Nouvelle promo`)
- [ ] 5 canaux (Sur place / Livraison / Uber / Takeaway / Appli)
- [ ] Popup `Commande enregistrée`
- [ ] Dernières commandes + `+ Tel` optionnel
- [ ] **Référence : 15 screenshots + V5 HTML**

### **P2 — Sync + Idempotency** (semaine 3)
- [ ] Dexie queue + background sync
- [ ] `client_uuid` idempotency (UNIQUE constraint)
- [ ] Pull zones/promos → Dexie
- [ ] Test offline/online (DevTools network throttle)
- [ ] Test re-sync sans doublon

### **P3 — Admin Dashboard** (semaine 4)
- [ ] Écran PIN 2026
- [ ] Dashboard temps réel (filtres client + période)
- [ ] Cartes stats (Distribués, Utilisés, Taux, CA, CA/canal)
- [ ] Table par Zone + Table par Promo (Edit/Suppr)
- [ ] Clients (restaurants) + Dernières commandes

### **P4 — Rapports + Actions** (semaine 5)
- [ ] Export CSV
- [ ] Résumé WhatsApp (format exact 📦✅📈💰)
- [ ] Reset jour / Lock
- [ ] **Rapport Simple** (WhatsApp, coût/ROI/panier)
- [ ] **Rapport Privé** (zones, canaux, alertes, classement)

### **P5 — V2** (post-MVP)
- [ ] QR par zone/flyer (`qrcode.react`) → page commande directe
- [ ] Code promo unique par zone (ex: BLEU10) → pré-remplit zone
- [ ] Carte des zones
- [ ] Clients récurrents (RGPD consent)
- [ ] Test A/B flyers

### **P6 — Hardening + Delivery**
- [ ] Révocation tablette → wipe local (Dexie.clear())
- [ ] Backups Postgres
- [ ] RGPD (last-4 optionnel, consentement)
- [ ] Tests E2E (Playwright) : caisse 2s flow + sync + admin
- [ ] Deploy (PWA kiosk / APK via Capacitor)

---

## 7. Risques + Mitigations

| Risque | Impact | Mitigation |
|---|---|---|
| **V5 source non exportée** | Pixel-perfect approximation | 15 screenshots = reference. Ila tsarf source Meta AI → ghadi nkhedmo 3liha direct |
| **Multi-tenant RLS** | Data leak cross-restaurant | Test RLS per-tenant f P0. `restaurant_id` partout + policy |
| **Offline sync doublon** | CA faussé | `client_uuid` UNIQUE + idempotent endpoint |
| **Tablette volée/pérdue** | Data exposée | Remote wipe + PIN UX + chiffrement local optionnel |
| **Taille PWA tablette ancienne** | Slow | Bundle < 200KB, lazy-load admin |

---

## 8. Livrables finaux

- [ ] PWA Caisse (Mode Caisse, offline, verrouillée restaurant)
- [ ] Dashboard Admin Foued (PIN, stats, tables, rapports)
- [ ] Base Postgres multi-tenant + RLS
- [ ] Sync idempotent (Dexie → server)
- [ ] Export CSV + WhatsApp share
- [ ] Documentation déploiement + formation

---

## 9. Validation

Avant livraison, chaque point du **`BRIEF_ORKESTA.md` §13`** doit être coché + vérifié.

---

*Stack : React + Vite + TS strict + Tailwind + Dexie.js + PostgreSQL.*
*Backend : Supabase (fast) OU NestJS (control) — à confirmer.*
