# Critères de succès — Regex Power & Validation Visuelle (v0.6.0)

---

## Critères techniques (non-négociables, mesurés à la mise en production)

- [ ] **Zero incident ReDoS en production** : aucun timeout du cron d'extraction (`daily-sync`) imputable à un pattern utilisateur dans les 30 jours post-lancement. Mesure : monitoring des logs `[EXTRACTION TIMEOUT]`.

- [ ] **Tous les tests existants restent verts** : `pnpm test` exit 0 sans modification des suites de tests v0.5.0. Les 174 tests (ou le nombre courant) passent sans régression. Mesure : CI/CD obligatoire sur merge.

- [ ] **`tsc --noEmit` exit 0** : aucune erreur de typage introduite par la feature. Mesure : CI/CD.

- [ ] **Lighthouse Performance score inchangé** (`+/- 2 points` de tolérance) sur les pages `/settings` et `/missing-action`. Mesure : audit Lighthouse avant/après.

- [ ] **Validation anti-ReDoS testée sur le corpus de patterns dangereux** : les patterns `(a+)+`, `(a|a)+`, `(.+)+\s`, `(a*)*b`, `([a-z]+)*` sont tous rejetés par le validateur avec code `422`. Mesure : test unitaire dédié.

- [ ] **Pattern valide se compile et s'exécute en < 200ms** sur une chaîne de 10 000 caractères (aligné sur le timeout `vm.runInNewContext` D1). Mesure : test de performance automatisé (Vitest `bench` ou équivalent).

---

## Critères d'adoption (mesurés à J+30 post-lancement)

- [ ] **15-25% des utilisateurs actifs ayant au moins 1 type custom ont activé le mode regex** sur au moins un type. Mesure : requête DB `SELECT COUNT(*) FROM "CustomActionType" WHERE "patternMode" = 'regex'` comparé au total de types actifs.

- [ ] **Taux de validation au premier essai >= 60%** : proportion de soumissions du formulaire regex (POST/PATCH `regexPattern`) qui reçoivent un `2xx` sans erreur de validation préalable. Mesure : ratio `201/200` vs `422` sur l'endpoint dans les logs.

- [ ] **Temps moyen de création d'une règle regex < 2 minutes** (de l'ouverture du dialog à la sauvegarde réussie). Mesure : analytics événementiels (optionnel à J+30, peut être estimé via retour utilisateur).

---

## Critères de qualité d'extraction (mesurés à J+30)

- [ ] **Aucune régression sur les actions de types natifs** : le nombre moyen d'Actions `SEND/CALL/FOLLOW_UP/PAY/VALIDATE` créées par utilisateur actif reste stable (`+/- 10%`) par rapport à v0.5.0. Mesure : comparaison des stats DB semaine avant / semaine après déploiement.

- [ ] **Précision subjective : >= 70% des actions de type CUSTOM (mode regex) sont pertinentes** selon l'utilisateur (non-ignorées dans les 48h). Mesure : taux de `Action.status = IGNORED` pour les actions `type = CUSTOM` créées via pattern regex vs keywords.

---

## Critères d'adoption des templates et de la zone de test (mesurés à J+30)

- [ ] **>= 30% des créations de types regex utilisent un template métier comme point de départ** (proxy adoption templates D4). Mesure : event analytics sur le bouton "Templates métier" → sélection template → sauvegarde réussie, comparé au total de créations en mode regex.

- [ ] **Nombre moyen de clics sur "Tester" avant validation >= 2** (proxy : l'utilisateur itère sur sa regex avant de sauvegarder, ce qui indique que la zone de test est utilisée activement). Mesure : event analytics sur le bouton "Tester" par session de création/édition, moyenné sur les 30 premiers jours.

---

## Critères de satisfaction utilisateur (mesurés à J+30 à J+60)

- [ ] **NPS sur le thème "le système comprend mes règles métier" : +10 points** par rapport au NPS v0.5.0 sur la même question. Mesure : micro-sondage in-app ou email post-usage (Resend).

- [ ] **Moins de 5 tickets de support liés à "mon pattern ne marche pas"** dans les 30 premiers jours. Mesure : suivi manuel. Objectif : la visualisation (Epic 2) auto-sert les utilisateurs avant qu'ils contactent le support.

---

## Acceptance Criteria par MUST (Given/When/Then)

### AC-R01 — Mode regex stocké et récupéré correctement
- **Given** un utilisateur crée un type custom avec `patternMode: "regex"` et `regexPattern: "FAC-\\d{4}-\\d{3,6}"`
- **When** il consulte la liste de ses types via `GET /api/custom-action-types`
- **Then** la réponse inclut `{ patternMode: "regex", regexPattern: "FAC-\\d{4}-\\d{3,6}", keywords: [] }`

### AC-R02 — Backward compatibility total en mode keywords
- **Given** un type custom existant v0.5.0 avec `keywords: ["review", "PR"]` et sans `regexPattern`
- **When** le cron daily-sync s'exécute
- **Then** `patternMode` est implicitement `"keywords"`, `compileCustomRegex` compile `\b(review|PR)\b` — comportement identique à v0.5.0 — aucune Action existante n'est altérée

### AC-R03 — Rejet d'un pattern dangereux (ReDoS)
- **Given** un utilisateur soumet `PATCH /api/custom-action-types/[id]` avec `regexPattern: "(a+)+b"`
- **When** la validation s'exécute
- **Then** la réponse est `422` avec `{ error: "Pattern dangereux détecté — risque de performance extrême", code: "REDOS_RISK" }` et aucune modification n'est persistée en DB

### AC-R04 — Rejet d'une syntaxe regex invalide
- **Given** `regexPattern: "[\\w+"` (crochet non fermé)
- **When** validation
- **Then** `422` avec `{ error: "Syntaxe de pattern invalide", detail: "Un crochet '[' est ouvert mais non fermé" }` (message lisible, pas le message V8 brut)

### AC-R05 — Highlight temps réel dans la zone de test
- **Given** l'utilisateur est dans le dialog Settings, mode regex, `regexPattern: "FAC-\\d{4}"`
- **When** il saisit dans la zone de test : `"Merci de valider la FAC-2024 avant vendredi"`
- **Then** en moins de 400ms (debounce 300ms + render), le texte `FAC-2024` apparaît surligné dans l'aperçu

### AC-R06 — Extraction correcte d'une Action via pattern regex
- **Given** un type custom `Facture` avec `patternMode: "regex"`, `regexPattern: "FAC-\\d{4}-\\d{3,6}"`, `isActive: true`
- **And** un email contenant `"Merci de valider la FAC-2024-001 avant le 30 mai"`
- **When** le cron `daily-sync` ou `POST /api/email/analyze` s'exécute
- **Then** une `Action` est créée avec `type: "CUSTOM"`, `customTypeLabel: "Facture"`, `sourceSentence` contenant `"FAC-2024-001"`, `dueDate: 30 mai`

### AC-R07 — Les types custom en mode keywords (v0.5.0) ne matchent pas si mode regex actif sur un autre type
- **Given** deux types : `TypeA (keywords: ["review"])` et `TypeB (regex: "FAC-\\d+")` 
- **And** email : `"Peux-tu reviewer la FAC-1234 avant demain ?"`
- **When** extraction
- **Then** deux Actions créées : une CUSTOM TypeA (sur "reviewer"), une CUSTOM TypeB (sur "FAC-1234") — pas de confusion de mode

### AC-R08 — Mode regex inactif ignoré au scan
- **Given** un type `Facture` avec `mode: "regex"`, `isActive: false`
- **When** scan email
- **Then** aucune Action de type CUSTOM créée pour ce pattern (comportement identique au cas keywords désactivé — US-5.5 inchangé)

### AC-D1a — Highlight zone de test Settings (D3)
- **Given** une regex passant `safe-regex` (ex. `FAC-\d{4}`)
- **When** l'utilisateur colle la phrase `"Merci de valider la FAC-2024 avant vendredi"` dans la zone de test et clique "Tester"
- **Then** le span `FAC-2024` est surligné en jaune dans la phrase affichée ; le reste du texte reste non surligné

### AC-D1b — Rejet ReDoS gate primaire (D1)
- **Given** un utilisateur soumet `regexPattern: "(.*)*"` (pattern craftée pour ReDoS)
- **When** l'API de création/édition valide le pattern
- **Then** `422` retourné avec `{ error: "Pattern dangereux détecté — risque de performance extrême", code: "REDOS_RISK" }` — aucune persistance en DB

### AC-D1c — Timeout runtime : email skip, scan continue (D1)
- **Given** un pattern passant `safe-regex` mais provoquant un backtracking catastrophique sur un email spécifique (faux négatif `safe-regex`)
- **When** le scan `daily-sync` applique ce pattern au corps de l'email
- **Then** après 200ms : l'email est skip, `[EXTRACTION TIMEOUT] pattern=<slug> email=<id>` est loggé en warning, le scan continue sur l'email suivant sans interruption ni exception propagée

### AC-D4 — Sélection d'un template métier (D4)
- **Given** l'utilisateur est dans le dialog de création d'un type custom, mode keywords par défaut
- **When** il clique sur "Templates métier" et sélectionne "Facture FAC-XXXX"
- **Then** le formulaire bascule automatiquement en mode regex, le champ `regexPattern` est pré-rempli avec `FAC-\d{4}-\d{3,6}`, le champ reste éditable, et la zone de test est disponible immédiatement
