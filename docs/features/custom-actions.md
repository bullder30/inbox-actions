# Feature Spec — Actions personnalisées utilisateur

**Phase 3 (AMC Lifecycle) — input pour Phase 4 (TDD Red).**

Cette spec traduit les 5 epics MUST du [Big Picture](../big-picture/epics.md) en user stories Given/When/Then exhaustives. Elle s'appuie sur les décisions verrouillées en Phase 1 (D1-D4) et l'architecture définie en Phase 2 ([ADRs](../architecture/adrs/), [data-model](../architecture/data-model.md), [api-contracts](../architecture/api-contracts.md)).

---

## 1. Context

### Personas couverts
- **Marc** (avocat solo) — types métier : "Dépôt greffe", "RDV client", "Recherche jurisprudence"
- **Léa** (freelance dev) — types métier : "Review code", "Mise en prod", "Daily stand-up"
- **Camille** (manager équipe) — types métier : "1-to-1", "Validation budget", "Reporting hebdo"

### Epics couverts
- Epic 1 — Modèle de données (table `CustomActionType` + enum `CUSTOM` + snapshot)
- Epic 2 — CRUD complet depuis Settings
- Epic 3 — Intégration au pipeline d'extraction
- Epic 4 — Création depuis missing-action (ponctuel ou règle)
- Epic 5 — Affichage badge custom dans ActionCard

### Pourquoi maintenant
Les 5 types natifs (`SEND | CALL | FOLLOW_UP | PAY | VALIDATE`) ne couvrent pas tous les métiers. Sans la possibilité de créer ses propres types, l'utilisateur reste bloqué sur "Il manque une action" en boucle pour les mêmes patterns récurrents. La feature préserve la philosophie produit : **transparence + déterminisme** (règles explicables, pas d'IA).

---

## 2. User Stories

### US-1 — Lister mes types personnalisés (Epic 2)

**En tant qu'**utilisateur connecté **je veux** voir la liste de mes types custom dans Settings **afin de** comprendre mon paysage actuel et décider d'en créer / modifier / supprimer.

#### Scénario US-1.1 — Affichage nominal
- **Given** je suis authentifié et j'ai 3 types custom (`Review code`, `Daily stand-up`, `Mise en prod`)
- **When** j'accède à `/settings` et je scroll jusqu'à la section "Mes types d'actions"
- **Then** je vois les 3 types affichés sous forme de cards, ordonnés par `createdAt desc`
- **And** chaque card affiche : nom + couleur (pastille à gauche) + nombre de keywords + badge `actif` ou `désactivé` + boutons `Modifier` et `Supprimer`

#### Scénario US-1.2 — État vide
- **Given** je suis authentifié et j'ai 0 type custom
- **When** j'accède à `/settings` section "Mes types d'actions"
- **Then** je vois un état empty avec une icône, un texte explicatif ("Aucun type personnalisé pour le moment") et un CTA "Créer mon premier type"

#### Scénario US-1.3 — Non authentifié
- **Given** je n'ai pas de session
- **When** je tente d'accéder à `/settings`
- **Then** je suis redirigé vers `/login` (middleware existant `middleware.ts`)

---

### US-2 — Créer un type custom depuis Settings (Epic 2)

**En tant qu'**utilisateur connecté **je veux** créer un nouveau type custom **afin de** capturer une action récurrente propre à mon métier.

#### Scénario US-2.1 — Création nominale
- **Given** je suis sur `/settings`, j'ai 0 type custom existant
- **When** je clique "Créer un type" → un dialog s'ouvre
- **And** je saisis nom = `Review code`, keywords = `["review", "PR", "merge request"]`, couleur = `violet`
- **And** je valide
- **Then** l'API `POST /api/custom-action-types` est appelée avec body `{ name: "Review code", keywords: [...], color: "violet" }`
- **And** la réponse est `201` avec `{ type: { id, name, slug: "review_code", keywords, color, isActive: true, createdAt } }`
- **And** le dialog se ferme, la liste affiche le nouveau type
- **And** un toast "Type 'Review code' créé" apparaît

#### Scénario US-2.2 — Création sans couleur explicite
- **Given** je n'ai pas choisi de couleur dans le picker (ou sélection neutre "auto")
- **When** je valide
- **Then** le serveur assigne une couleur par rotation : `palette[count % 8]` (où count = nombre de types existants au moment de la création)
- **And** la réponse contient cette couleur dans `type.color`

#### Scénario US-2.3 — Limite atteinte
- **Given** j'ai déjà 10 types custom
- **When** je tente d'en créer un 11ème via le formulaire
- **Then** l'API renvoie `400` avec `{ error: "Vous avez atteint la limite de 10 types personnalisés" }`
- **And** le formulaire affiche cette erreur dans une toast destructive
- **And** le dialog reste ouvert pour permettre l'annulation ou la modification

#### Scénario US-2.4 — Conflit de slug
- **Given** j'ai un type existant `Review Code` (slug: `review_code`)
- **When** je tente de créer un type nommé `review-code` (slug serait également `review_code`)
- **Then** l'API renvoie `409` avec `{ error: "Un type avec un nom équivalent existe déjà" }`
- **And** le formulaire affiche le message dans une toast destructive
- **And** le dialog reste ouvert

#### Scénario US-2.5 — Nom invalide (vide ou trop long)
- **Given** je saisis nom = `""` (vide) OU nom = string de 51 chars
- **When** je valide
- **Then** la validation Zod renvoie `422` avec `{ error: "Nom invalide", details: ["Le nom doit contenir entre 1 et 50 caractères"] }`
- **And** le champ nom est entouré d'une bordure rouge avec le message d'erreur sous le champ

#### Scénario US-2.6 — Keyword trop court
- **Given** je saisis keywords = `["pr", "review"]` (premier < 4 chars)
- **When** je valide
- **Then** l'API renvoie `422` avec `{ error: "Mots-clés invalides", invalidKeywords: ["pr"], reason: "min_length" }`
- **And** le champ keywords affiche le détail

#### Scénario US-2.7 — Keyword dans la stoplist FR
- **Given** je saisis keywords = `["envoie", "le", "documents"]` (`"le"` est stopword)
- **When** je valide
- **Then** l'API renvoie `422` avec `{ error: "Mots-clés trop génériques", invalidKeywords: ["le"] }`

#### Scénario US-2.8 — Keyword trop long (anti-ReDoS)
- **Given** je saisis un keyword de 61 chars
- **When** je valide
- **Then** l'API renvoie `422` avec `{ error: "Mot-clé trop long", invalidKeywords: [...], maxLength: 60 }`

#### Scénario US-2.9 — Plus de 50 keywords
- **Given** je saisis 51 keywords valides
- **When** je valide
- **Then** l'API renvoie `422` avec `{ error: "Trop de mots-clés (max 50)" }`

---

### US-3 — Modifier un type custom existant (Epic 2)

**En tant qu'**utilisateur **je veux** modifier un type que j'ai créé **afin de** affiner ses keywords ou changer son nom/couleur quand mon usage évolue.

#### Scénario US-3.1 — Renommage nominal
- **Given** j'ai un type `Review code` (slug: `review_code`)
- **When** je clique "Modifier" → dialog pré-rempli → je change le nom en `Code review` → je valide
- **Then** `PATCH /api/custom-action-types/[id]` est appelée avec `{ name: "Code review" }`
- **And** le slug est régénéré côté serveur (`code_review`)
- **And** la réponse est `200` avec le type mis à jour
- **And** la liste UI met à jour le nom et le slug
- **And** un toast "Type modifié" apparaît
- **Important** : les `Action` historiques liées à ce type **gardent leur ancien `customTypeLabel`** (`Review code`) — voir snapshot pattern (ADR-001)

#### Scénario US-3.2 — Renommage avec conflit de slug
- **Given** j'ai deux types : `Review code` (slug: `review_code`) et `Daily stand-up` (slug: `daily_stand_up`)
- **When** je modifie `Daily stand-up` en le renommant `review code`
- **Then** l'API renvoie `409` (conflit avec le slug existant `review_code`)
- **And** le dialog reste ouvert avec l'erreur affichée

#### Scénario US-3.3 — Désactivation
- **Given** j'ai un type `Daily stand-up` actif avec 5 Actions historiques
- **When** je modifie via toggle `isActive: false`
- **Then** l'API renvoie `200` avec `isActive: false`
- **And** la card de ce type affiche un badge "désactivé" en gris
- **And** au prochain scan d'emails, ce type n'est PAS chargé par l'extracteur (filter `isActive: true` au query Prisma)
- **And** les 5 Actions historiques restent inchangées et visibles dans `/actions` avec leur badge

#### Scénario US-3.4 — Changement de couleur
- **Given** j'ai un type `Review code` couleur `violet` avec 3 Actions historiques
- **When** je change la couleur en `indigo`
- **Then** l'API renvoie `200`, le type a maintenant `color: "indigo"`
- **And** la card UI affiche maintenant la pastille indigo
- **And** les 3 Actions historiques **gardent `customTypeColor: "violet"` snapshot** (badge inchangé)
- **And** les futures Actions extraites avec ce type auront `customTypeColor: "indigo"`

#### Scénario US-3.5 — Tentative de modifier le type d'un autre user
- **Given** un autre user a un type avec `id = "abc123"`
- **When** je tente `PATCH /api/custom-action-types/abc123` avec mes credentials
- **Then** l'API renvoie `403 Forbidden` (vérification stricte `type.userId === session.user.id`)

#### Scénario US-3.6 — Modifier un type inexistant
- **Given** aucun type n'existe avec `id = "ghost"`
- **When** je tente `PATCH /api/custom-action-types/ghost`
- **Then** l'API renvoie `404 Not Found`

---

### US-4 — Supprimer un type custom (Epic 2)

**En tant qu'**utilisateur **je veux** supprimer un type que je n'utilise plus **afin de** garder ma liste maintenable.

#### Scénario US-4.1 — Suppression nominale (sans Actions liées)
- **Given** j'ai un type `Daily stand-up` créé hier, aucune Action ne lui est liée
- **When** je clique "Supprimer" sur sa card → un dialog de confirmation s'ouvre ("Êtes-vous sûr ? Cette action est irréversible.")
- **And** je confirme
- **Then** `DELETE /api/custom-action-types/[id]` est appelée
- **And** la réponse est `200` avec `{ success: true, affectedActions: 0 }`
- **And** la card disparaît de la liste avec une animation exit
- **And** un toast "Type supprimé" apparaît

#### Scénario US-4.2 — Suppression avec Actions actives liées
- **Given** j'ai un type `Review code` avec 3 Actions de status `TODO` liées
- **When** je clique "Supprimer" → confirmation → confirme
- **Then** la transaction Prisma exécute :
  - `DELETE FROM CustomActionType WHERE id = ?` (cascade `onDelete: SetNull` nullifie automatiquement `customTypeId` sur les 3 Actions)
- **And** la réponse est `200` avec `{ success: true, affectedActions: 3, message: "3 actions actives gardent ce label figé" }`
- **And** un toast info apparaît : "Type supprimé. 3 actions actives gardent ce label figé."
- **And** dans `/actions`, les 3 Actions restent visibles avec leur badge `Review code` en violet (snapshots intacts)

#### Scénario US-4.3 — Suppression non autorisée
- **Given** un autre user a un type avec `id = "abc123"`
- **When** je tente `DELETE /api/custom-action-types/abc123`
- **Then** l'API renvoie `403 Forbidden`

#### Scénario US-4.4 — Suppression d'un type inexistant
- **Given** aucun type avec `id = "ghost"`
- **When** je tente `DELETE /api/custom-action-types/ghost`
- **Then** l'API renvoie `404 Not Found`

#### Scénario US-4.5 — Snapshot integrity post-deletion
- **Given** un type a été supprimé, ses Actions liées ont `customTypeId = NULL` et gardent `customTypeLabel`/`customTypeColor`
- **When** je consulte une de ces Actions dans `/actions/[id]`
- **Then** le badge affiche le label et la couleur snapshots
- **And** aucun lien cliquable ne tente de naviguer vers le type supprimé

---

### US-5 — Détection automatique d'un type custom dans un email (Epic 3)

**En tant qu'**utilisateur **je veux** que mes types custom soient détectés automatiquement lors du scan **afin de** ne pas avoir à créer manuellement chaque action récurrente.

#### Scénario US-5.1 — Détection nominale
- **Given** j'ai un type custom `Review code` avec keywords `["review", "PR"]`, isActive: true
- **And** un email arrive : "Bonjour, peux-tu faire la review de la PR #42 avant vendredi ? Merci."
- **When** le cron `daily-sync` tourne ou l'API `/api/email/analyze` est appelée
- **Then** l'extracteur charge mes `customActionType` depuis Prisma (`where: { userId, isActive: true }`)
- **And** l'extracteur custom détecte le keyword "review" + objet concret ("PR #42") + deadline ("vendredi") → match valide
- **And** une `Action` est créée avec :
  - `type: "CUSTOM"`
  - `customTypeId: "<id du type Review code>"`
  - `customTypeLabel: "Review code"` (snapshot)
  - `customTypeColor: "violet"` (snapshot)
  - `title: "Review de la PR #42"` (déduit de la phrase)
  - `dueDate: <date de vendredi>`
  - `sourceSentence: "peux-tu faire la review de la PR #42 avant vendredi"`

#### Scénario US-5.2 — Phrase conditionnelle ignorée (gating partagé)
- **Given** mon type `Review code` avec keywords `["review"]`
- **And** un email : "Si tu as le temps, tu pourrais review la PR ?"
- **When** l'extracteur tourne
- **Then** le gating anti-ambiguïté détecte le marqueur faible "si tu as le temps"
- **And** **aucune Action n'est créée** (cohérent avec le comportement des 5 types natifs)

#### Scénario US-5.3 — Keyword absent
- **Given** mon type `Review code` avec keywords `["review", "PR"]`
- **And** un email : "Bonjour, peux-tu valider le contrat ?"
- **When** l'extracteur tourne
- **Then** aucune action de type CUSTOM n'est créée pour cet email
- **And** une action de type natif `VALIDATE` peut être créée si les patterns natifs matchent (logique existante)

#### Scénario US-5.4 — User sans types custom (perf optim)
- **Given** je n'ai aucun `CustomActionType`
- **When** le scan tourne
- **Then** la query `prisma.customActionType.findMany()` retourne `[]`
- **And** `extractActionsFromEmail()` est appelée avec `customTypes: []`
- **And** l'extracteur custom n'est PAS exécuté (early return : `if (customTypes.length === 0) return []`)
- **Mesure** : pas de coût additionnel pour les users sans types custom

#### Scénario US-5.5 — Type désactivé ignoré
- **Given** j'ai un type `Daily stand-up` avec `isActive: false`
- **When** le scan tourne
- **Then** la query Prisma `findMany({ where: { userId, isActive: true } })` exclut ce type
- **And** aucune Action de ce type n'est créée même si un email matchait

#### Scénario US-5.6 — Dedup avec un type natif
- **Given** mon type custom `Envoi facture` a un keyword `"envoyer"` (qui collide avec le pattern SEND natif)
- **And** un email "merci d'envoyer la facture demain"
- **When** l'extracteur tourne
- **Then** les patterns natifs créent une Action `SEND`
- **And** l'extracteur custom créerait aussi une Action `CUSTOM`
- **But** `deduplicateActions()` (fonction existante) détecte la double-extraction via `sourceSentence` similaire et conserve une seule Action
- **Décision MVP** : conserver l'Action **native** (priorité aux 5 types natifs en cas de doublon, simple à implémenter)

---

### US-6 — Créer un type ponctuel depuis missing-action (Epic 4 — cas A)

**En tant qu'**utilisateur sur `/missing-action` **je veux** créer une Action avec un nouveau type sans persister de règle **afin de** capturer un cas unique sans polluer mes types custom récurrents.

#### Scénario US-6.1 — Création ponctuelle nominale
- **Given** je suis sur `/missing-action`, je clique "Créer une action" sur un email
- **And** dans le dialog, je sélectionne dans le Select "Créer un nouveau type custom..."
- **And** un sous-formulaire apparaît : champs `nom`, `couleur` (palette 8), keywords pré-remplis depuis `sourceSentence` (mots-clés extraits)
- **And** un toggle "Cette fois seulement" / "Toujours détecter à l'avenir" est positionné sur "Cette fois seulement"
- **When** je remplis nom = `Audit RGPD ponctuel`, couleur = `amber` et je valide
- **Then** `POST /api/actions/manual` est appelée avec body :
  ```json
  {
    "title": "...", "type": "CUSTOM", "customTypeName": "Audit RGPD ponctuel",
    "customTypeColor": "amber", "persistAsRule": false,
    "sourceSentence": "...", "emailFrom": "...", "emailReceivedAt": "..."
  }
  ```
- **And** la réponse est `201` avec `{ action: { type: "CUSTOM", customTypeId: null, customTypeLabel: "Audit RGPD ponctuel", customTypeColor: "amber", ... } }`
- **And** **AUCUN** enregistrement n'est créé dans la table `CustomActionType`
- **And** je suis redirigé vers `/actions` avec un toast "Action créée"

#### Scénario US-6.2 — Keywords visibles mais ignorés (cas A)
- **Given** dans le sous-formulaire en mode "Cette fois seulement", le champ keywords est visible (pré-rempli depuis la phrase source)
- **When** je modifie ces keywords ou les laisse tels quels
- **Then** ces keywords sont ignorés côté serveur (puisque `persistAsRule: false`)
- **And** rien n'est persisté en DB côté CustomActionType
- **UX** : optionnellement, masquer le champ keywords quand le toggle est sur "Cette fois seulement" (clarté visuelle)

---

### US-7 — Créer un type permanent depuis missing-action (Epic 4 — cas B)

**En tant qu'**utilisateur **je veux** transformer une action manuelle en règle de détection future **afin de** automatiser ce qui se répète sans configuration séparée dans Settings.

#### Scénario US-7.1 — Création de règle nominale
- **Given** je suis dans le dialog missing-action, sous-formulaire "Créer un nouveau type"
- **And** le toggle est sur "Toujours détecter à l'avenir"
- **And** keywords pré-remplis = `["review", "PR", "merge"]` (extraits de la phrase)
- **When** je saisis nom = `Code review`, couleur = `violet`, je valide
- **Then** `POST /api/actions/manual` est appelée avec `persistAsRule: true`
- **And** côté serveur, une transaction Prisma exécute :
  1. Créer le `CustomActionType` (mêmes validations que `POST /api/custom-action-types`)
  2. Créer l'`Action` avec `customTypeId = <nouveau id>`, snapshots label/color, status TODO
- **And** réponse `201` avec `{ action: {...}, createdCustomType: {...} }`
- **And** je suis redirigé vers `/actions` avec un toast "Action créée + règle 'Code review' activée"

#### Scénario US-7.2 — Échec création (limite 10 atteinte)
- **Given** j'ai déjà 10 types custom existants
- **When** dans le sous-formulaire missing-action je tente de créer un 11ème type avec `persistAsRule: true`
- **Then** la transaction Prisma échoue à l'étape 1 (count >= 10 → 400)
- **And** la transaction est rollback : ni le `CustomActionType` ni l'`Action` ne sont créés
- **And** la réponse API est `400` avec `{ error: "Vous avez atteint la limite de 10 types personnalisés" }`
- **And** le dialog reste ouvert avec l'erreur affichée + suggestion : "Choisissez 'Cette fois seulement' OU supprimez un type existant"

#### Scénario US-7.3 — Échec validation keywords
- **Given** keywords contiennent `["le"]` (stopword)
- **When** je valide avec `persistAsRule: true`
- **Then** réponse `422` avec `{ error: "Mots-clés invalides", invalidKeywords: ["le"] }`
- **And** la transaction est rollback (rien créé)
- **And** le dialog reste ouvert

#### Scénario US-7.4 — Pré-remplissage intelligent des keywords
- **Given** la phrase source = "peux-tu reviewer la PR avant demain ?"
- **When** le sous-formulaire s'ouvre
- **Then** les keywords pré-remplis sont extraits via une heuristique simple :
  - Tokeniser la phrase
  - Filtrer la stoplist FR
  - Filtrer les mots < 4 chars
  - Retenir les 3-5 mots les plus significatifs
- **Exemple** : `["reviewer", "PR", "demain"]` (l'utilisateur peut éditer)
- **NB** : ce pré-remplissage est une **suggestion**, pas une obligation — l'utilisateur peut tout ré-écrire

---

### US-8 — Affichage du badge custom dans ActionCard (Epic 5)

**En tant qu'**utilisateur **je veux** distinguer visuellement mes types custom des types natifs **afin de** scanner ma liste d'actions plus rapidement.

#### Scénario US-8.1 — Affichage nominal (variant default)
- **Given** une Action avec `type: "CUSTOM"`, `customTypeLabel: "Review code"`, `customTypeColor: "violet"`
- **When** elle est rendue dans une `ActionCard` variant `default`
- **Then** le badge affiche `Review code` avec les classes Tailwind correspondant à `violet` (mapping via `lib/custom-action-colors.ts`)
- **And** le badge a la même taille / position / typo que les badges des 5 types natifs (cohérence visuelle)

#### Scénario US-8.2 — Affichage post-suppression du type (snapshot frozen)
- **Given** une Action a été créée il y a 1 mois avec un type `Daily stand-up` couleur `blue`
- **And** ce type a été supprimé entre-temps (`Action.customTypeId = NULL`)
- **When** l'Action est rendue
- **Then** le badge affiche toujours `Daily stand-up` en bleu (snapshots `customTypeLabel` + `customTypeColor` intacts)
- **And** aucune indication "type supprimé" n'est affichée (transparence : l'action reflète l'état au moment de l'extraction)

#### Scénario US-8.3 — Affichage post-rename du type
- **Given** type `Review code` créé, génère 5 Actions
- **When** l'utilisateur renomme le type en `Code review`
- **Then** les 5 Actions historiques continuent d'afficher `Review code` (snapshot)
- **And** les nouvelles Actions extraites afficheront `Code review`

#### Scénario US-8.4 — Affichage en variant `compact` (dashboard recent actions) [OQ-1 tranchée]
- **Given** une Action de type CUSTOM est rendue dans `RecentActionsList` (dashboard, ActionCard variant `compact`)
- **When** elle est affichée
- **Then** le badge custom est rendu **avec sa couleur snapshot** (cohérence visuelle), en taille `text-xs`
- **Décision** : pas de badge gris générique ; on garde la couleur même en compact pour ne pas perdre l'info de différenciation

---

## 3. Acceptance Criteria globaux

| ID | Critère | Mesure / Test |
|---|---|---|
| AC-1 | Limite 10 types/user enforced API | Test : créer 10 types puis 11ème → assert 400 |
| AC-2 | Slug deterministic | `nameToSlug("Review Code") === "review_code"` (test unitaire pure) |
| AC-3 | Slug unique per user | Violation `@@unique` Prisma → API renvoie 409 |
| AC-4 | Couleur dans la palette des 8 | Couleur non admise → 422 ; couleur admise → 200/201 |
| AC-5 | Keyword 4-60 chars | Hors range → 422 avec `invalidKeywords` |
| AC-6 | Stoplist FR appliquée | Keyword `"le"` → 422 |
| AC-7 | Snapshot label/color figé sur Action | Test : créer Action → rename type → re-fetch Action → `customTypeLabel` inchangé |
| AC-8 | Cron daily-sync charge customTypes per user | Test : seed user + type + email matchant → run job → assert Action créée avec type CUSTOM |
| AC-9 | 174 tests existants restent verts | `pnpm test` exit 0 sans modif des suites existantes |
| AC-10 | TypeScript strict OK | `tsc --noEmit` exit 0 |
| AC-11 | Dedup natif > custom | Si extraction native + custom matchent même phrase, conserver native |
| AC-12 | Transaction rollback sur échec règle | Test : créer 11ème type via missing-action → assert ni type ni Action créés |
| AC-13 | Ownership stricte | Test : user A tente PATCH/DELETE type de user B → 403 |

---

## 4. Edge Cases (exhaustifs)

### 4.1 — Invalid input
| Cas | Comportement attendu |
|---|---|
| Nom uniquement caractères spéciaux (`"!!!"`) | Slug vide → 422 `"Nom ne peut être réduit à un slug valide"` |
| Keywords dupliqués (`["PR", "pr"]`) | Dédup côté API (lowercase + Set) → stocker `["pr"]` |
| Couleur uppercase (`"VIOLET"`) | Reject 422 (validation Zod stricte enum lowercase) |
| Body JSON malformé | Next.js renvoie 400 |
| `keywords` non array (string seule) | Zod reject 422 |
| `keywords` empty array | Zod reject 422 (`min(1)`) |
| `name` avec espaces uniquement | Trim + length check 0 → 422 |
| `keywords` contient une string vide `[""]` | Filtrer côté API ou reject 422 |

### 4.2 — Empty data
| Cas | Comportement attendu |
|---|---|
| User sans types custom | `GET /api/custom-action-types` → `{ types: [] }` ; extracteur skip phase custom |
| Settings page sans types | Empty state avec CTA visible |
| Type custom avec 0 keywords (impossible normalement) | Garde-fou : extracteur skip ce type silencieusement |

### 4.3 — Unauthorized / forbidden
| Cas | Code |
|---|---|
| Pas de session sur GET/POST/PATCH/DELETE | 401 |
| Tentative GET d'un type d'un autre user (via id deviné) | 403 |
| Tentative PATCH/DELETE d'un type d'un autre user | 403 |
| Tentative POST `/api/actions/manual` cas A avec `customTypeId` d'un autre user | 403 |

### 4.4 — Concurrency
| Cas | Comportement attendu |
|---|---|
| Double-clic POST création même nom | Premier réussit (201), second 409 grâce à `@@unique` |
| Concurrent DELETE et lecture en cours | OK : snapshots déjà figés sur Actions, pas de FK cassée |
| Race condition `count + create` (10ème vs 11ème) | Idéalement transaction `prisma.$transaction([count, create])` ; alternative simple : tolérer un over-by-one occasionnel (rare) — décision MVP : check + create dans une transaction |
| Modification simultanée du même type (deux onglets) | Last-write-wins (pas de versioning au MVP) |

### 4.5 — State transitions
| Cas | Comportement attendu |
|---|---|
| Action native (SEND) tentée d'être convertie en CUSTOM | API ne PATCH pas le champ `type` (read-only une fois créée) → 400 |
| isActive: false puis true plus tard | Type re-pris en compte au prochain scan |
| Suppression d'un type avec actions DONE/IGNORED uniquement | Suppression OK, snapshot intact, pas de message warning particulier |

### 4.6 — Snapshot integrity
| Cas | Comportement attendu |
|---|---|
| Suppression d'un type avec 50 Actions liées | 1 query DELETE + cascade SetNull → < 100ms (acceptable) |
| Migration Postgres enum non-transactionnelle | Déployer migration AVANT le code applicatif (CI/CD ordre garanti par `prisma migrate deploy` exécuté avant `next build`) |
| Type renommé puis re-renommé vers ancien nom | Slug régénéré, peut conflict avec lui-même initial → 409 si autre type s'est appelé entre-temps avec ce nom |

---

## 5. Impacted Files

| Fichier | Action | Notes |
|---|---|---|
| `prisma/schema.prisma` | MODIFY | Ajout enum `CUSTOM` + table `CustomActionType` + 3 colonnes Action + index |
| `prisma/migrations/<date>_custom_action_types/migration.sql` | CREATE | Généré par `prisma migrate dev` |
| `lib/actions/extract-actions-regex.ts` | MODIFY | Signature `extractActionsFromEmail(ctx, exclusions, customTypes = [])` + nouvelle fonction `extractCustomActionsFromEmail()` |
| `lib/cron/daily-sync-job.ts` | MODIFY | Charger `customActionType` per user (where isActive: true), passer à l'extracteur |
| `app/api/email/analyze/route.ts` | MODIFY | Idem |
| `app/api/custom-action-types/route.ts` | CREATE | GET (list) + POST (create) |
| `app/api/custom-action-types/[id]/route.ts` | CREATE | PATCH (update) + DELETE |
| `app/api/actions/manual/route.ts` | MODIFY | Extension body : cas A (customTypeId existant) + cas B (persistAsRule, transaction Prisma) |
| `app/(protected)/settings/page.tsx` | MODIFY | Import + render `<CustomActionTypesSection />` |
| `components/settings/custom-action-types-section.tsx` | CREATE | Liste + dialog création/édition + dialog confirm suppression (analogue à `ExclusionSection`) |
| `app/(protected)/missing-action/page.tsx` | MODIFY | Select étendu avec option "Créer un nouveau type" + sous-formulaire toggle ponctuel/règle |
| `components/actions/action-card.tsx` | MODIFY | Si `type === "CUSTOM"`, render badge avec `customTypeLabel` + `customTypeColor` snapshots (variants default ET compact) |
| `lib/custom-action-colors.ts` | CREATE | Constantes palette 8 couleurs + mapping `color → { bgClass, textClass }` |
| `lib/slug.ts` | CREATE | Helper pure `nameToSlug(name): string` |
| `lib/stoplist-fr.ts` | CREATE | Liste minimaliste de mots-vides FR (~50 mots) |
| `tests/api/custom-action-types.test.ts` | CREATE | Phase 4 (red) — couvre US-1 à US-4, AC-1, AC-3, AC-4, AC-5, AC-6, AC-13 |
| `tests/extract-custom-actions.test.ts` | CREATE | Couvre US-5 (gating, dedup, snapshot) + AC-7, AC-8, AC-11 |
| `tests/api/actions-manual-custom.test.ts` | CREATE | Couvre US-6 et US-7 (cas A et B avec transaction) + AC-12 |
| `tests/lib/slug.test.ts` | CREATE | Couvre AC-2 (pure function) |

---

## 6. API Contract — résumé

Détails complets dans [`docs/architecture/api-contracts.md`](../architecture/api-contracts.md). Résumé tabulaire :

| Endpoint | Method | Status codes attendus |
|---|---|---|
| `/api/custom-action-types` | GET | 200 (list) ; 401 |
| `/api/custom-action-types` | POST | 201 ; 400 (limite) ; 409 (slug) ; 422 (validation) ; 401 |
| `/api/custom-action-types/[id]` | PATCH | 200 ; 403 (ownership) ; 404 ; 409 (slug) ; 422 ; 401 |
| `/api/custom-action-types/[id]` | DELETE | 200 ; 403 ; 404 ; 401 |
| `/api/actions/manual` (étendu) | POST | 201 ; 400 (limite via cas B) ; 403 ; 422 ; 401 |

---

## 7. Data Model Changes — résumé

Détails complets dans [`docs/architecture/data-model.md`](../architecture/data-model.md). Résumé :

| Entité | Changement |
|---|---|
| `ActionType` (enum) | + valeur `CUSTOM` |
| `CustomActionType` (table) | NEW : id, userId, name, slug, keywords[], color, isActive, timestamps + `@@unique([userId, slug])` + `@@index([userId, isActive])` |
| `Action` | + `customTypeId String?` (FK SetNull) + `customTypeLabel String?` (snapshot) + `customTypeColor String?` (snapshot) + `@@index([userId, status, type, customTypeId])` |
| `User` | + relation `customActionTypes` |

---

## 8. Out of Scope (V1 MVP)

- ❌ Marketplace de templates de types par métier (COULD futur)
- ❌ Suggestions IA-light de patterns à partir de la phrase (COULD futur, hors philosophie déterministe)
- ❌ Multi-langue (les keywords restent FR uniquement, comme l'extracteur natif)
- ❌ Re-scan rétroactif des emails après modification d'un type (modification = règle pour le futur uniquement, ADR-001)
- ❌ Filtre par type custom dans `/actions` (Epic 5.2 SHOULD, à reprendre en V1.1)
- ❌ Partage / export / import de types entre users (V2)
- ❌ Cache LRU des patterns compilés (ADR-002, YAGNI au MVP — limite 10 × 50 keywords compile en < 1ms)
- ❌ Suffixe automatique sur conflit de slug (ADR-003, transparence > magie)
- ❌ Versioning des types (rollback) — V2 si besoin
- ❌ Import depuis CSV / templates communautaires
- ❌ Webhooks / API publique pour intégrations tierces

---

## 9. Open Questions — tranchées dans cette spec

| ID | Question | Décision retenue |
|---|---|---|
| OQ-1 | ActionCard `compact` affiche-t-il le badge couleur custom ? | **OUI** — cohérence visuelle, taille `text-xs` (voir US-8.4) |
| OQ-2 | Avertissement à la création quand un keyword collide avec un pattern natif (ex. "envoyer") ? | **NON bloquant**, dedup côté extracteur suffit (US-5.6 + AC-11). Possible amélioration UX V1.1 : warning soft "Ce mot-clé est déjà utilisé par le type natif Envoyer" |
| OQ-3 | La stoplist FR est-elle un fichier dur ou paramétrable ? | **Fichier dur** (`lib/stoplist-fr.ts`, ~50 mots-vides FR) au MVP. Paramétrable en V2 si besoin |

Aucune question ouverte restante. La Phase 4 (TDD red) peut démarrer.

---

## Gate Phase 3 — statut

| Critère | Statut |
|---|---|
| Chaque user story a au moins un scénario Given/When/Then | ✅ 8 US × 3-9 scénarios |
| Chaque AC est testable | ✅ 13 AC, tous mesurables |
| Impacted files référence des paths réels | ✅ Cross-checkés avec exploration Phase 1 (extracteur, missing-action, settings, etc.) |
| Edge cases couvrent invalid input / empty data / unauthorized / concurrency / state | ✅ 6 catégories, 25+ cas |

**Phase 4 — TDD Red** (`/amc-dev-lifecycle:tdd-red-phase`) peut démarrer.
