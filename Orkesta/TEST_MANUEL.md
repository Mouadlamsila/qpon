# Orkesta — Checklist test manuel

Durée ≈ 20 min. Coche ✅ mn ma tkml kol bloq. Chb3 l'evidence (screenshot / ligne DB) f chaque bloq critique.

## 0. Setup

- [ ] `cd Orkesta\app && npm run dev` → ouvre **http://localhost:5173** (caisse)
- [ ] Admin = **http://localhost:5173/admin**
- [ ] Chrome → F12 (DevTools) ouvert pendant kol l'test
- [ ] Supabase → Table Editor ouvert (2e fenêtre) bach tchouf l'rows live

---

## 1. Caisse — flow normal (online)

- [ ] `/` → **Connexion restaurant** kaybano (AuthGate) — bla login ma kaynch caisse
- [ ] Login `crousty@orkesta.com` — mot de passe : **`app/CREDENTIALS.local.md`** → caisse kayfta7
- [ ] **Aucun bouton Admin visible** · pas de sélecteur multi-restaurant (1 tenant ghir)
- [ ] Choisis client → **Crousty Verviers**
- [ ] Chois zone (ex: BLEU) → promo → canal (ex: SUR_PLACE) → bouton vert **✓ Enregistrer** ywali activé
- [ ] Tap **✓ Enregistrer** → toast ✓ **avec zone + promo + canal** → **selection entière t3awed** (client suivant prêt) < 2 sec
- [ ] Section **Dernières commandes** → commande jdida btrej` f l'wast **w ba9ya mwjouda men ba3d sync** (heure + zone + promo + canal)

**Evidence**: Supabase → `orders` → row jdida, `client_uuid` = UUID, `zone_id` mlée.

- [ ] **Badge ⏳** ma yzhar-ch (online = sync instantanée) — OR yzhar w y3ad mn ba3d (≤ 15 sec)

---

## 2. ⭐ Sync offline → online (l'core — lhaja l'mohimma)

- [ ] DevTools → onglet **Network** → **Throttling: Offline**
- [ ] Caissier → enregistre **3 commandes** (kol wahda zone/promo différent)
- [ ] Badge **⏳ 3 commandes en attente de sync** yzhar (qsar, ma fach erreur)
- [ ] App ba9i t7ader normal — ma t7bbsch, ma errorch
- [ ] Throttling → **No throttling** (online)
- [ ] **≤ 15 sec** → badge ⏳ y3ad (wla offline, jdid: ymchi b visibilitychange → switch tab w rwj3)
- [ ] Supabase → `orders` → **les 3 rows** wufaq b client_uuid
- [ ] Admin → dashboard → KPIs **utilisés +3**, CA zad

**Red flag**: 🚨 rows ma tzadouch → sync khdbah = STOP, report.

- [ ] **Idempotency manual**: clic 3la **✓ Enregistrer 3 marrat b chkaj** (bl 3ajala) f page offline → online → kol commande **= 1 row**, ma kaynch dupes

---

## 3. RLS / Sécurité (multi-tenant)

- [ ] Data API test (haka, mchi f navigateur): PostgREST query b **anon key** bla auth → `orders` = `[]`
- [ ] Admin login → dashboard → orders wufaq (bypass)
- [ ] Incognito bla login → **mode Admin** → PIN 2026 → **Login** → `foued@orkesta.com` (mdp : `app/CREDENTIALS.local.md`) → dashboard yfta7
- [ ] Password ghalat → erreur claire (ma t9ollch "utilisateur inexistant" vs "mot de passe" — chi haja)

---

## 4. Admin / Reports (P3+P4)

- [ ] **Filtre restaurant** : « Tous clients » ↔ **Crousty Verviers** → KPI/tables changent, pas de data mélangée
- [ ] **Périodes** : Auj. / Semaine / Mois / Tout → chiffres + « vs période préc. » cohérents
- [ ] 10 KPI + panier moyen + coût/commande/ROI (— si pas de coût saisi)
- [ ] **Table par zone** → posés/used/taux/CA ; modifier **posés** (input) → taux se recalcule
- [ ] **Table par promo** → used/CA + **Désactiver/Activer**
- [ ] **Clients — classement** (mode Tous) → CA + panier moyen
- [ ] **Dernières commandes** → heure + restaurant + zone + promo + canal + montant
- [ ] **Export CSV** → `orkesta-<période>-<date>.csv`, colonne `restaurant`, Excel FR OK
- [ ] **Résumé WhatsApp** → **aperçu** (copier / ouvrir) avec coût, ROI, panier, comparaison :
  ```
  Bilan Crousty Verviers — TOUT:
  📦 Distribués: …
  ✅ Utilisés: …
  📈 Taux: …%
  💰 CA Total: …€
  🍽 Sur Place: …€
  🛵 Livraison: …€
  💸 Coût campagne: …€
  📊 Coût / commande: …€
  📈 ROI: …%
  🧺 Panier moyen: …€
  📅 vs période précédente: …%
  ```
- [ ] **Coût campagne** : sélectionne un resto → saisis 100 → ROI/comparaison se mettent à jour
- [ ] **QR par zone** → 3 QRs → phone: scan BLEU → app yfta7 w **zone BLEU déjà sélectionnée**
- [ ] **+ Restaurant** → formulaire → si Edge Function déployée : nouveau resto dans le sélecteur ; sinon message clair (fallback `scripts/add-restaurant.mjs`)
- [ ] Auto-refresh ≤ 30 s : nouvelle commande caisse → dashboard se met à jour sans reload
- [ ] Thème admin **sombre** (header + dashboard), lisible tablette/PC

---

## 5. Code promo + création (P1+P5)

- [ ] Input **Code promo** → `bleu10` → ✓ zone BLEU sélectionnée + message vert
- [ ] `XXX99` → ✗ message rouge "code inconnu"
- [ ] **+ Nouvelle zone** → modal → tzid zone jdida → btrej` f grid
- [ ] **+ Nouvelle promo** → modal → btrej`
- [ ] **+ Tel (optionnel)** → tel 10 chiffres → ma ykhzzanch ghir **4 derniers**

---

## 6. Révocation / wipe (P6 — BRIEF §8)

- [ ] Admin → **Lock** (sign-out) → rwj3 l `/` → **AuthGate login** (kolchi local mss7, serveur intact)
- [ ] Rje3 login `crousty@orkesta.com` → zones/promos/orders kayrj3ou **mn Supabase** (mchi mn seed)
- [ ] ⚠️ Tchecki qbel haka: les rows **f Supabase ba9yin** (wipe = local only, serveur = source of truth)

---

## 7. Responsive (PC / tablet)

- [ ] Chrome → Ctrl+Shift+M → iPhone → layout kif 9bel (phone)
- [ ] iPad / 768px → zones/promos **4 f ligne**, KPI **3 f ligne**, content centered
- [ ] PC / 1440px → ma kaynch 3amod faragh te3 448px, header centered, bouton Enregistrer mwsal m3a content
- [ ] Clics f kol les sizes → ma kaynch horizontal scroll

---

## 8. Install PWA

- [ ] Chrome → icône **Install** f address bar → ytsenna7b
- [ ] App tsenna7b → tfta7 bghira → header ORKESTA OS → ba9i khdama

---

## Report

Ila l9iti bug → ktobha haka: **screenshot + console (F12) + minimum steps de repro**. Kol bug = n5allsoh qbel delivery.

| # | Bloq | Resultat | Bug? |
|---|---|---|---|
| 1-8 | … | ✅/✗ | … |
