# Epics & Features — Regex Power & Validation Visuelle (v0.6.0)

MoSCoW appliqué sur un scope MVP de 1-2 semaines de dev focus (1 développeur).
Effort : S < 1 jour / M = 1-3 jours / L = 3-5 jours / XL > 5 jours.

---

## Epic 1 — Modèle de données et compilation regex

**Description** : Étendre `CustomActionType` pour supporter deux modes de pattern (`keywords` ou `regex`). Le mode `regex` stocke directement le pattern brut saisi par l'utilisateur. La compilation reste à la volée (ADR-002 inchangé), mais utilise le pattern brut au lieu de compiler depuis la liste de keywords.

| # | Feature | Priority | Effort | Dependencies | Critère testable |
|---|---------|----------|--------|--------------|---|
| 1.1 | Champ `mode: "keywords" \| "regex"` (enum) sur `CustomActionType` (migration Prisma) | MUST | S | — | Given un type créé en mode `regex`, `mode === "regex"` en DB |
| 1.2 | Champ `regexPattern String?` nullable sur `CustomActionType` (stocke le pattern brut validé) | MUST | S | 1.1 | Given `regexPattern = "FAC-\d{4}"`, `compileCustomRegex()` retourne un `RegExp` équivalent |
| 1.3 | Champ `validated Boolean` (résultat `safe-regex` au moment de la création — true si pattern passé la gate primaire) | MUST | S | 1.1, 1.2 | Given pattern accepté par `safe-regex`, `validated = true` en DB ; Given pattern rejeté, sauvegarde bloquée avant persistance |
| 1.4 | `compileCustomRegex(mode, keywords, regexPattern)` — branche les deux modes dans l'extracteur | MUST | S | 1.1, 1.2 | Given `mode = "keywords"`, comportement identique à v0.5.0 (174 tests existants verts) |
| 1.5 | Validation backend anti-ReDoS — gate primaire : `safe-regex` (rejet 422 si dangereux) + longueur max 200 chars | MUST | M | 1.2 | Given `(a+)+`, l'API renvoie `422 { error: "Pattern dangereux détecté", code: "REDOS_RISK" }` — aucune persistance en DB |
| 1.6 | Validation backend — filet runtime : `vm.runInNewContext` timeout 200ms à l'exécution scan ; si déclenché → log warning + skip email (scan continue) | MUST | M | 1.2 | Given pattern craftée pour ReDoS passant `safe-regex` (faux négatif), When scan email, Then email skip + log `[EXTRACTION TIMEOUT]`, scan non interrompu |
| 1.7 | Validation backend : syntaxe regex valide (`new RegExp(pattern)` wrappé en try/catch) | MUST | S | 1.2 | Given `"[\w+"` (crochet non fermé), l'API renvoie `422` avec message lisible (pas le message V8 brut) |
| 1.8 | Flags autorisés : `i` (insensible casse) uniquement — les autres flags (`g`, `m`, `s`, `u`) injectés par le système, non configurables par l'user | MUST | S | 1.2 | Given un pattern contenant le flag `g`, validation échoue avec 422 |
| 1.9 | Migration Prisma réversible (`prisma migrate dev`) | MUST | S | 1.1, 1.2, 1.3 | `prisma db push` sans erreur sur schéma existant ; rollback possible |

---

## Epic 2 — Interface Settings : sélecteur de mode et zone de test

**Description** : Étendre le dialog de création/édition des types custom (Settings) pour afficher un sélecteur de mode (keywords / regex avancé) et une zone de test interactive où l'utilisateur colle des phrases et voit les matches surlignés.

| # | Feature | Priority | Effort | Dependencies | Critère testable |
|---|---------|----------|--------|--------------|---|
| 2.1 | Toggle "Activer le mode regex avancé" dans le dialog `CustomActionType` (Settings + `/missing-action`) — bascule le formulaire : champ keywords masqué, champ unique "Pattern regex" affiché | MUST | S | Epic 1.1 | Given clic sur "Activer le mode regex avancé", le champ keywords disparaît et un champ "Pattern regex" apparaît à sa place |
| 2.2 | Zone de test interactive (Settings) : textarea "Phrases à tester" + bouton "Tester" + highlight visuel des matches (spans surlignés en jaune) | MUST | M | 2.1 | Given `regexPattern = "FAC-\d{4}"` et phrase collée `"Merci d'envoyer la FAC-2024-001"`, le span `FAC-2024` est surligné en jaune dans l'aperçu |
| 2.3 | Highlight via endpoint serveur `/api/custom-action-types/test-regex` (POST `{ pattern, text }`) — pas d'exécution regex brute côté client (cohérence serveur garantie + sécurité) | MUST | S | 2.2 | Given appel POST avec pattern et phrase, réponse inclut positions `[{ start, end }]` des matches ; Given pattern invalide, réponse 422 |
| 2.4 | Message d'erreur lisible sur syntaxe invalide (ex. "Un crochet `[` est ouvert mais pas fermé") | MUST | S | 2.1 | Given `"[\w+"`, le champ regex affiche l'erreur humaine sans soumettre le formulaire |
| 2.5 | Message d'avertissement non-bloquant si le pattern est très permissif (match sur toute la phrase) | SHOULD | S | 2.2 | Given `.+`, un warning "Ce pattern matchera quasiment tout" apparaît, le save reste possible |
| 2.6 | Mode keywords inchangé par défaut (backward compat totale) — le toggle "Mode avancé" est discret, absent si mode keywords | MUST | S | 2.1 | Given un type v0.5.0 existant ouvert en édition, il s'affiche en mode keywords sans modification visible |

---

## Epic 3 — Validation visuelle depuis `/missing-action`

**Description** : Depuis la page `/missing-action`, quand l'utilisateur crée ou sélectionne un type custom en mode regex, il voit en temps réel les phrases du corps complet de l'email qui matchent ou non le pattern en cours d'édition. Inclus dans le MVP v0.6.0 (D3).

| # | Feature | Priority | Effort | Dependencies | Critère testable |
|---|---------|----------|--------|--------------|---|
| 3.1 | Composant `RegexEmailPreview` : affiche le corps complet de l'email avec highlights temps réel (debounce 300ms) | MUST | L | Epic 2.3, 3.4 | Given la regex change, les highlights se mettent à jour en < 300ms ; Given une regex passant `safe-regex`, When phrase collée, Then matches surlignés en jaune dans la phrase |
| 3.2 | Indicateur visuel : phrases matchées (fond jaune/highlight) vs non-matchées (texte neutre) | MUST | S | 3.1 | Given 3 phrases, 1 match : la phrase matchée est surlignée, les 2 autres restent neutres |
| 3.3 | Compte de matches affiché ("2 matches dans cet email") | COULD | S | 3.1 | — |
| 3.4 | Endpoint `/api/email/[id]/body` (GET) — récupère le corps complet à la volée via le provider (IMAP ou Graph), sans stockage (RGPD) — **à créer** (n'existe pas dans `app/api/email/`) | MUST | M | — | Given un email IMAP ou Graph, GET `/api/email/[id]/body` retourne `{ body: string }` ; Given email inexistant ou non-ownership, 404 |

---

## Epic 4 — Librairie de templates métier

**Description** : Proposer un catalogue de 10-15 patterns regex pré-définis par secteur métier (finance, juridique, DSI, RH). Fichier statique `lib/regex-templates.ts`. L'utilisateur choisit un template, le pattern est pré-rempli et reste éditable avant sauvegarde. Inclus dans le MVP v0.6.0 (D4).

| # | Feature | Priority | Effort | Dependencies | Critère testable |
|---|---------|----------|--------|--------------|---|
| 4.1 | Définition statique des templates (`lib/regex-templates.ts` : slug, nom, pattern, catégorie, description, exemple de phrase) | MUST | S | — | `getTemplateBySlug("invoice-number")` retourne `{ pattern: "FAC-\\d{4}-\\d{3,6}", category: "comptabilite" }` |
| 4.2 | UI "Partir d'un template" dans le dialog Settings : bouton ouvre liste filtrée par catégorie (comptabilité / juridique / IT / RH) | MUST | M | 4.1, Epic 2.1 | Given clic "Templates métier", liste s'affiche avec description par catégorie ; Given sélection "Facture FAC-XXXX", le champ `regexPattern` est pré-rempli et editable |
| 4.3 | Pré-remplissage du champ `regexPattern` depuis le template sélectionné — le formulaire bascule automatiquement en mode regex | MUST | S | 4.2 | Given template sélectionné, `regexPattern` pré-rempli, toggle mode regex actif, zone de test disponible immédiatement |
| 4.4 | 10-15 templates initiaux : numéro facture (`FAC-\d{4}-\d+`), avoir, dossier juridique (`dossier n°\d+`), RG tribunal, ticket Jira (`JIRA-\d+`), PR GitHub (`PR #\d+`), deploy prod, CRA/note de frais, bulletin de paie, référence contrat | MUST | S | 4.1 | Chaque template testé unitairement contre ≥ 2 phrases réelles (match attendu) et ≥ 1 phrase négative (non-match attendu) |

---

## Epic 5 — Fonctionnalités avancées (post-MVP)

**Description** : Fonctionnalités à valeur réelle mais non nécessaires pour le MVP. Peuvent être livrées en v0.7.0 ou plus.

| # | Feature | Priority | Effort | Dependencies | Raison du report |
|---|---------|----------|--------|--------------|---|
| 5.1 | Groupes de capture nommés : `(?<numero>FAC-\d+)` exposé dans le `title` de l'Action générée | COULD | L | Epic 1 | Complexifie l'extracteur et l'affichage ; valeur limitée en MVP |
| 5.2 | Profiler de regex : affiche le nombre de steps V8 pour le pattern sur une phrase longue | COULD | M | Epic 1 | Outil de debug avancé, audience très réduite |
| 5.3 | Partage de templates entre users d'une même organisation | COULD | XL | Auth multi-org (pas encore en place) | Dépendance majeure hors scope |
| 5.4 | Templates communautaires (marketplace) | WONT | XL | 5.3 + plateforme de modération | Hors philosophie produit MVP |
| 5.5 | Exécution regex côté client (dans le navigateur) comme alternative au serveur | WONT | M | — | Risque de fuite de pattern et de ReDoS sans sandbox — interdit |
| 5.6 | Regex partagées avec des outils tiers (Zapier, Make) | WONT | XL | API publique (non planifiée) | Hors scope |
| 5.7 | ML-augmented regex : suggestion IA du pattern à partir d'exemples | WONT | XL | — | Contredit la philosophie "déterminisme + zéro magie" |

---

## Scope MVP v0.6.0 (décisions D1-D4 verrouillées)

Epics 1, 2, 3 et 4 sont tous MUST pour le MVP v0.6.0. Aucun report autorisé sur les features MUST.

**Effort total MVP** :
- Epic 1 : 6S + 2M = ~5-6 jours (dont 2 jours anti-ReDoS double couche)
- Epic 2 : 4S + 1M = ~3-4 jours
- Epic 3 : 2M + 1L = ~4-6 jours (dont création endpoint `/api/email/[id]/body`)
- Epic 4 : 3S + 1M = ~2-3 jours

**Total estimé : 14-19 jours de dev focus.** Cible réaliste sur 3-4 semaines en solo.

Epic 5 reste post-MVP (COULD/WONT inchangés).
