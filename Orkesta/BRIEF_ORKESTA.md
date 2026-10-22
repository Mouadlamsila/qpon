# ORKESTA OS — Brief Produit (Client)

> Document de cadrage. Ce qui suit est la **vision métier** de l'application, telle que définie par Foued.
> Côté technique (serveur, base de données, sécurité, synchronisation) est traité dans un dossier séparé.

---

## 1. Résumé du produit

**Orkesta OS** est un outil de **suivi de campagnes marketing par flyers** pour restaurants.

Ce n'est **pas** une caisse enregistreuse classique. Ce n'est **pas** un logiciel de gestion de restaurant, de stock ou de fiches clients.

Son unique rôle : **prouver à Foued — et à ses clients restaurants — quelles zones, quelles promotions et quels canaux de commande fonctionnent réellement.**

Foued est un **distributeur de flyers**. Il distribue des flyers imprimés, par zones colorées, pour plusieurs restaurants (Crousty Verviers, Crousty Dison, etc.). Orkesta transforme ces flyers en **données mesurables**.

**Valeur commerciale :**
- Foued sait **quelle zone rapporte** et laquelle gaspille son budget.
- Foued sait **quelle promo attire** et laquelle il faut arrêter.
- Foued prouve au restaurant que **ses flyers font venir des clients** (même ceux qui commandaient ailleurs).
- Foued sait **où ouvrir le prochain restaurant**.

---

## 2. Le problème que ça résout

Aujourd'hui, un distributeur de flyers ne sait **rien** :
- Il donne 1450 flyers, il ne sait pas combien ont été utilisés.
- Il ne sait pas si le client a pris le flyer pour commander **sur place**, **en livraison**, **sur Uber**, **sur Takeaway** ou **via l'application**.
- Il ne sait pas quelle zone a généré du chiffre d'affaires.
- Il ne peut donc **justifier son prix** au restaurant, ni améliorer ses campagnes.

Orkesta comble ce vide : **chaque commande est rattachée à une zone, une promo et un canal.**

---

## 3. Le flux métier (parcours complet)

1. **Foued** distribue des flyers, par zones colorées (ex : BLEU Centre, VERT Hodimont, MALMEDY). Chaque zone a un **nombre de flyers distribués**.
2. **Le client final** reçoit son flyer coloré + une promo (ex : code `BLEU10`).
3. Le client **appelle le restaurant** et donne sa **couleur de zone** + son **code promo** oralement.
4. Le **serveur du restaurant** tape sur sa tablette, en moins de **2 secondes** : la zone → la promo → le canal.
5. La commande est **enregistrée**.
6. **Foued** consulte les statistiques : il sait exactement quelle zone/promo/canal a fonctionné.

---

## 4. Mode CAISSE — ce dont le serveur a besoin

Le serveur du restaurant n'utilise que le **Mode Caisse**. Il doit être **extrêmement rapide** (2 secondes maximum par commande).

### 4.1 Sélection du client (restaurant)
- Une carte **« CHOISIS CLIENT »** avec la liste des restaurants (ex : Crousty Verviers).
- Une fois le restaurant choisi, la tablette est **verrouillée** sur ce restaurant.

### 4.2 Sélection de la zone
- Cartes de zones colorées : **BLEU Centre**, **VERT Hodimont**, **MALMEDY**, etc.
- Chaque carte affiche : nom de la zone + code (ex : BLEU).
- Sélection = **bordure noire + coche blanche**.
- Bouton **« + Nouvelle zone »** (pointillé) pour en créer une à la volée.

### 4.3 Sélection de la promo
- Cartes de promos : **Chimitanga de l'ouest**, **Lili la dinde**, **Mitraillette Max**, **Crousty x3**, **Tasty box famillie**, etc.
- Chaque promo affiche des badges : **PRIX MASQUÉ** / **ACTIVE**.
- Bouton **« + Nouvelle promo »** (pointillé).

### 4.4 Sélection du canal (5 canaux)
- **Sur place**
- **Livraison directe**
- **Uber**
- **Takeaway**
- **Appli**

> Ces 5 canaux permettent de détecter le **changement d'habitude** : le client reçoit le flyer mais commande sur Uber → on le mesure.

### 4.5 Confirmation
- Une popup **« Commande enregistrée »** apparaît, avec : zone + promo + canal.

### 4.6 Dernières commandes
- Liste des dernières commandes (heure, restaurant, zone, promo, canal, montant).
- Bouton optionnel **« + Tel »** pour ajouter les **4 derniers chiffres** du téléphone, plus tard dans la soirée.

### 4.7 Règles du Mode Caisse
- **Pas de champ téléphone obligatoire** → la caisse doit rester rapide (2 sec).
- **Pas de chiffres affichés** → sélection tactile, pas de saisie numérique.
- **Fonctionne hors ligne** → si la connexion tombe, la commande est enregistrée localement et se synchronise au retour du réseau.
- **Aucun accès aux statistiques ni à l'administration.**

---

## 5. Mode ADMIN (Foued) — ce dont Foued a besoin

Le Mode Admin est **réservé à Foued**, protégé par un **code PIN (2026)**.

### 5.1 Écran de verrouillage
- **« Mode Foued — PIN requis »**
- Saisie du code à 4 chiffres.

### 5.2 Dashboard
- Titre : **« DASHBOARD FOUED — Performance temps réel »**
- Sélecteur de restaurant : **« Tous clients »** ou un restaurant précis.
- Filtres de période : **Aujourd'hui / Semaine / Mois / Tout**.

### 5.3 Cartes de statistiques
- **TOTAL DISTRIBUÉS** — nombre de flyers posés (ex : 1450)
- **TOTAL UTILISÉS** — codes encaissés (ex : 1)
- **TAUX GLOBAL** — taux de conversion (ex : 0%)
- **CA TOTAL** — chiffre d'affaires total (ex : 55€)
- **CA SUR PLACE**
- **CA LIVRAISON**
- *(CA Uber / Takeaway / Appli)*

### 5.4 Boutons d'action
- **Export CSV** — téléchargement des données
- **Résumé WhatsApp** — génération d'un message prêt à envoyer
- **Reset jour** — réinitialiser la vue du jour
- **Lock** — verrouiller l'accès

### 5.5 Table par zone
Colonnes : **Zone / Couleur / Donnés / Utilisés / Taux**

Exemple :
| Zone | Couleur | Donnés | Utilisés | Taux |
|---|---|---|---|---|
| BLEU Centre | BLEU | 500 | 1 | — |
| VERT Hodimont | VERT | 350 | 0 | — |
| MALMEDY | MALM | 400 | 0 | — |

> C'est ici que Foued voit **quelle zone arrêter** (ex : VERT Hodimont à 0%).

### 5.6 Table par promo
Colonnes : **Nom / Prix sur place / Prix livraison / Utilisés / CA / Edit / Suppr**

Exemple :
| Promo | Prix | Utilisés | CA |
|---|---|---|---|
| Mitraillette Max | 8€ / 10.5€ | 0 | 0€ |
| Crousty x3 | 20€ / 25€ | 0 | 0€ |
| Tasty box famillie | 30€ / 35€ | 0 | 0€ |
| Chimitanga de l'ouest | 50€ / 55€ | 1 | 55€ |
| Lili la dinde | 20€ / 25€ | 0 | 0€ |

### 5.7 Clients (restaurants)
- Liste des restaurants gérés.
- Chaque fiche : nom + panier moyen (ex : Crousty Verviers — Panier 14.5€).

### 5.8 Aperçu WhatsApp
- Aperçu du message de bilan généré, prêt à copier/ envoyer.

### 5.9 Dernières commandes
- Historique des commandes : heure + badge canal + restaurant + zone + promo + montant.

---

## 6. Statistiques & KPI (les chiffres qui comptent)

Tous les calculs sont **dynamiques** (jamais figés / jamais hardcodés).

- **Distribués** = somme des flyers distribués par zone
- **Utilisés** = nombre de commandes enregistrées
- **Taux** = Utilisés / Distribués × 100
- **CA par canal** (Sur place, Livraison, Uber, Takeaway, Appli)
- **Top zones** (triées par chiffre d'affaires)
- **Top promos**
- **Panier moyen** = CA / nombre de commandes
- **Coût par commande** = coût campagne / commandes
- **ROI** = (CA − coût campagne) / coût campagne × 100
- **Comparaison période** (par rapport à la semaine précédente)

---

## 7. Rapports (2 niveaux)

### 7.1 Rapport SIMPLE (à envoyer au restaurant)
Format **WhatsApp** (texte + emojis), prêt à copier.

Exemple exact :
```
Salut Ahmed, Bilan CROUSTY OS (Tous clients) - TODAY:
📦 Distribués: 1450
✅ Utilisés: 1
📈 Taux: 0%
💰 CA Total: 55.00€
🍽 Sur Place: 0.00€
🛵 Livraison: 55.00€

Top Zones:
- BLEU Centre: 1 (55.00€)
- VERT Hodimont: 0 (0.00€)
- MALMEDY: 0 (0.00€)

Généré via CROUSTY OS
```

Contenu du rapport simple :
- Coût campagne (€) — saisi par Foued
- Nombre de commandes générées
- CA
- ROI
- Coût par commande
- Panier moyen
- Comparaison de période

### 7.2 Rapport DÉTAILLÉ / PRIVÉ (pour Foued seul)
- Détail par zone et par promo (ex : BLEU 0.8% vs VERT 0% → arrêter VERT)
- Analyse des canaux (perte 30% vers Uber → bascule vers Direct)
- Alertes (zone VERT à 0% après 10 jours)
- Tests A/B (2 visuels/offres sur 2 zones équivalentes → lequel gagne)
- Clients récurrents (RGPD — consentement)
- Classement des restaurants par rentabilité (pour Foued multi-restos)
- Conseil : **où ouvrir le prochain restaurant**

---

## 8. Règles absolues (non négociables)

1. **Le restaurant n'a JAMAIS accès à l'administration.** Ni export, ni lien vers les statistiques, ni accès admin. Il n'a que la tablette en Mode Caisse, verrouillée.
2. **Une tablette est affectée à un seul restaurant.** Elle ne permet pas de changer librement de restaurant.
3. **Si la collaboration s'arrête → la tablette est vidée.** Plus de données privées, plus d'historique, plus de synchronisation.
4. **Les données restent chez Foued** (cloud). Jamais chez le restaurant.
5. **Pas de champ téléphone obligatoire en caisse.** Le téléphone reste optionnel (4 derniers chiffres pour clients récurrents, avec consentement RGPD).
6. **Aucune donnée personnelle dans le rapport simple** (pas d'exposition de téléphone).

---

## 9. Fonctionnalités V2 (priorité haute)

1. **QR code par flyer / par zone** — le client scan → page de commande directe. Permet de mesurer les scans + appels, sans saisie manuelle du serveur.
2. **Code promo unique par zone** (ex : `BLEU10`) — pré-remplit la zone, réduit les erreurs de saisie et améliore l'attribution.
3. **Carte des zones** — visualiser les rues qui rapportent pour décider d'une redistribution.
4. **Suivi des clients récurrents** (RGPD + SMS/WhatsApp promo).
5. **Tableau de bord multi-restaurants** — classement de rentabilité pour Foued.
6. **Test A/B flyers** — 2 visuels/offres sur 2 zones équivalentes, l'app dit le gagnant.

---

## 10. Données d'exemple (100% modifiables)

> Toutes les valeurs ci-dessous sont des **exemples inventés** pour la démo. Elles doivent être **entièrement modifiables** par l'utilisateur (création / édition / suppression). **Ne jamais les figer dans le code.**

**Zones (exemples) :**
- BLEU Centre — code BLEU — couleur bleue — 500 flyers
- VERT Hodimont — code VERT — couleur verte — 350 flyers
- MALMEDY — code MALM — couleur noire — 400 flyers
- NAMUR CENTRE — code NAMU — couleur bleue — 200 flyers

**Promos (exemples) :**
- Chimitanga de l'ouest — 50€ / 55€
- Lili la dinde — 20€ / 25€
- Mitraillette Max — 8€ / 10.5€
- Crousty x3 — 20€ / 25€
- Tasty box famillie — 30€ / 35€

**Restaurants (exemples) :**
- Crousty Verviers
- Crousty Dison
- Crousty Ensival

**Codes promo (exemples) :** `BLEU10`, `VERT10`, etc.

---

## 11. Design de référence (V5)

L'interface **V5** fait foi. Elle doit être **reproduite à l'identique** (pixel perfect).

**Identité visuelle :**
- Logo : lettre **« C »** orange dans un cercle
- Typographie : **Geist / Geist Mono** (style trapu, sans empattement)
- Rayon des cartes : **28px** (arrondi marqué)
- Couleurs :
  - Orange (accent principal) : **#FF4D00**
  - Beige (fond Mode Caisse) : **#FEF9EC**
  - Noir (texte / boutons) : **#111111**
  - Zones : BLEU **#2563EB**, VERT **#16A34A**, NOIR **#0F0F0F**, ORANGE **#F97316**
  - Gris inactif : **#E5E7EB**
  - Vert WhatsApp : **#22C55E**

**Mode Caisse** : fond beige clair, cartes vives, sélection à bordure noire.
**Mode Admin** : fond noir, cartes sombres, accents orange/blanc.

> ⚠️ **Ne jamais modifier** le rayon (28px), la couleur beige (#FEF9EC) ni l'orange (#FF4D00). Ce sont des repères visuels : le serveur doit reconnaître la zone en 0.5 seconde. Le cercle décoratif blanc à 15% d'opacité n'est pas décoratif — c'est un **repère visuel rapide**.

---

## 12. Ce qui N'EST PAS demandé

Pour éviter les dérives, voici ce qui **ne doit pas être inventé / ajouté** :

- ❌ Un nouveau système de caisse
- ❌ Un nouveau design (on garde V5)
- ❌ De nouvelles pages inutiles
- ❌ Un nouveau parcours de commande
- ❌ Un paiement complexe
- ❌ Une intégration Uber / Takeaway (API)
- ❌ Une IA prédictive
- ❌ Un logiciel de gestion de stock
- ❌ Un logiciel de gestion de restaurant / menus / réservations / livraison
- ❌ Un marketplace / catalogue public

**Ce n'est pas une demande de redesign. Ce n'est pas une demande de nouvelle caisse.**

---

## 13. Validation finale

Avant livraison, chaque point doit être **coché et vérifié** :

- [ ] Header : `ORKESTA OS` + C orange + toggle `MODE CAISSE` / `MODE ADMIN`
- [ ] Mode Caisse : sélection restaurant verrouillée
- [ ] Mode Caisse : cartes zones (création / édition / suppression)
- [ ] Mode Caisse : cartes promos (création / édition / suppression)
- [ ] Mode Caisse : 5 canaux
- [ ] Mode Caisse : popup « Commande enregistrée »
- [ ] Mode Caisse : dernières commandes + bouton « + Tel » optionnel
- [ ] Mode Caisse : fonctionne hors connexion
- [ ] Mode Admin : écran PIN
- [ ] Mode Admin : dashboard temps réel
- [ ] Mode Admin : filtres (restaurant + période)
- [ ] Mode Admin : toutes les cartes de statistiques
- [ ] Mode Admin : table par zone + table par promo
- [ ] Mode Admin : clients + dernières commandes
- [ ] Mode Admin : Export CSV
- [ ] Mode Admin : Résumé WhatsApp (format exact)
- [ ] Mode Admin : Reset jour (sans détruire l'historique)
- [ ] Mode Admin : Lock
- [ ] Rapport Simple (WhatsApp)
- [ ] Rapport Détaillé Privé (Foued)
- [ ] Le restaurant n'a **aucun** accès admin
- [ ] La tablette révoquée est vidée
- [ ] Aucune donnée d'exemple n'est figée dans le code
- [ ] Le design correspond exactement à la référence V5

---

*Ce document décrit la vision métier de Foued. Les aspects techniques (serveur, base de données, sécurité, synchronisation hors ligne) sont documentés à part.*
