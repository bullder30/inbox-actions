# Epics & Features — Actions personnalisées utilisateur

Scope MVP : 1 sprint (5 jours de dev focus). Chaque feature MUST a au moins un critère d'acceptation testable.

---

## Epic 1 — Modèle de données

Description: Étendre le schéma Prisma pour stocker les types custom et les lier aux actions existantes sans casser le pipeline en production.

| # | Feature | Priority | Effort | Dependencies |
|---|---------|----------|--------|--------------|
| 1.1 | Créer table `CustomActionType` (id, userId, name, slug, keywords[], isActive, createdAt) — unique constraint sur `[userId, slug]` | MUST | S | — |
| 1.2 | Ajouter valeur `CUSTOM` à l'enum `ActionType` | MUST | S | — |
| 1.3 | Ajouter champ `customTypeId String?` et `customTypeLabel String?` sur `Action` | MUST | S | 1.1, 1.2 |
| 1.4 | Migration Prisma + index sur `[userId, customTypeId]` | MUST | S | 1.1, 1.2, 1.3 |
| 1.5 | Ajouter champ `color String` (valeur parmi 8 couleurs prédéfinies, non nullable, défaut par rotation) sur `CustomActionType` | MUST | S | 1.1 |
| 1.6 | Ajouter champ `icon String?` (identifiant Lucide restreint) sur `CustomActionType` | COULD | S | 1.1 |

**Critères d'acceptation — 1.1 à 1.5 :**
- Given: le schéma est pushé en base
- When: on crée un `CustomActionType` pour un userId donné
- Then: la table contient la ligne, et on peut créer une `Action` avec `type=CUSTOM`, `customTypeLabel="DEPOT_GREFFE"`, `customTypeId` pointant vers la ligne

- Given: un user crée un type sans choisir de couleur
- When: il valide le formulaire
- Then: une couleur par défaut est assignée automatiquement parmi les 8 couleurs de la palette (rotation : `count_existing_types % 8`), le champ `color` n'est jamais null en base

- Given: un user crée un type avec le nom "Review Code"
- When: le slug interne est généré côté backend
- Then: sa valeur est `review_code` (lowercase, sans accents, espaces → underscore, caractères spéciaux supprimés)

- Given: un user a 10 types custom actifs
- When: il appelle `POST /api/custom-action-types` pour en créer un 11e
- Then: l'API renvoie HTTP 400 avec un corps `{ "error": "Limite de 10 types custom atteinte" }`

---

## Epic 2 — CRUD Settings

Description: Interface Settings permettant à l'utilisateur de créer, modifier, tester et supprimer ses types d'actions personnalisés. Seul point d'entrée pour la modification et la suppression — ces opérations ne sont pas disponibles depuis missing-action ni depuis ActionCard.

| # | Feature | Priority | Effort | Dependencies |
|---|---------|----------|--------|--------------|
| 2.1 | Page Settings > section "Mes types d'actions" : liste des types custom existants | MUST | S | Epic 1 |
| 2.2 | Formulaire de création d'un type custom : nom + mots-clés (tags input) | MUST | M | 2.1 |
| 2.3 | API CRUD : `POST /api/custom-action-types`, `GET`, `PUT /[id]`, `DELETE /[id]` | MUST | M | Epic 1 |
| 2.4 | Validation : nom unique par user (case-insensitive), au moins 1 mot-clé, limite 10 types par user | MUST | S | 2.3 |
| 2.5 | Modification d'un type custom existant : renommer le type, modifier les mots-clés, optionnellement changer la couleur | MUST | S | 2.3 |
| 2.6 | Suppression d'un type custom existant (depuis Settings uniquement) avec confirmation explicite | MUST | S | 2.3 |
| 2.7 | Bouton "Tester" : saisir une phrase test → voir si elle matche les patterns du type | SHOULD | M | 2.3 |
| 2.8 | Choix de couleur (palette 8 couleurs) lors de la création et de la modification | MUST | S | 1.5, 2.2 |
| 2.9 | Réordonner les types custom (drag-and-drop ou flèches) | COULD | M | 2.1 |
| 2.10 | Export / import JSON des types custom | COULD | M | 2.3 |
| 2.11 | Templates prédéfinis par métier (avocat, dev, manager…) à importer en un clic | COULD | L | 2.3 |
| 2.12 | Partage de templates entre utilisateurs (marketplace) | WONT | XL | — |

**Critères d'acceptation — 2.1 à 2.4 :**
- Given: l'utilisateur est sur Settings > "Mes types d'actions"
- When: il crée un type "DEPOT_GREFFE" avec les mots-clés "déposer", "dépôt au greffe"
- Then: la liste affiche le nouveau type, l'API retourne 201, et une deuxième création avec le même nom retourne 409 Conflict

- Given: l'utilisateur a déjà 10 types custom
- When: il tente d'en créer un 11e
- Then: le formulaire affiche une erreur "Limite de 10 types atteinte" et l'API retourne 400

**Critères d'acceptation — 2.5 (Update) :**
- Given: l'utilisateur est sur Settings > "Mes types d'actions" et dispose d'un type "DEPOT_GREFFE" avec mot-clé "déposer"
- When: il renomme le type en "DEPOT_TRIBUNAL" et ajoute le mot-clé "greffe du tribunal"
- Then: `PUT /api/custom-action-types/[id]` retourne 200, la liste reflète le nouveau nom et les nouveaux mots-clés, les Actions déjà extraites conservent leur `customTypeLabel="DEPOT_GREFFE"` figé (pas de re-scan rétroactif), les prochaines extractions utilisent les nouveaux mots-clés

- Given: l'utilisateur tente de renommer un type avec un nom déjà utilisé par un de ses autres types
- When: il soumet le formulaire de modification
- Then: l'API retourne 409 Conflict et le type n'est pas modifié

**Critères d'acceptation — 2.6 (Delete) :**
- Given: l'utilisateur est sur Settings > "Mes types d'actions" et dispose d'un type "DEPOT_GREFFE"
- When: il clique sur "Supprimer" et confirme la modale de confirmation
- Then: `DELETE /api/custom-action-types/[id]` retourne 200, le type disparaît de la liste, les prochaines extractions n'utilisent plus ce type ; les Actions existantes conservent `customTypeLabel="DEPOT_GREFFE"` lisible (le champ est dénormalisé) et `customTypeId` devient null (FK nullifiée, pas de cascade)

- Given: l'utilisateur tente de supprimer via ActionCard ou missing-action
- When: il inspecte ces interfaces
- Then: aucun bouton ou option "Supprimer le type" n'est présent — la suppression est exclusivement accessible depuis Settings

---

## Epic 3 — Intégration au pipeline d'extraction

Description: Le moteur regex (`lib/actions/extract-actions-regex.ts`) charge et exécute les patterns custom de l'utilisateur lors de chaque analyse d'email. Les types custom sont traités comme les 5 types natifs — même pipeline, même gating anti-ambiguïté.

| # | Feature | Priority | Effort | Dependencies |
|---|---------|----------|--------|--------------|
| 3.1 | Charger les `CustomActionType` actifs de l'utilisateur avant l'extraction | MUST | S | Epic 1 |
| 3.2 | Compiler les mots-clés en patterns regex (whole-word, case-insensitive, accents normalisés) | MUST | M | 3.1 |
| 3.3 | Exécuter les patterns custom dans `extractActionsFromEmail` après les 5 types natifs | MUST | S | 3.2 |
| 3.4 | Appliquer le même gating anti-ambiguïté (objet capturé OU marqueur fort) aux types custom | MUST | S | 3.3 |
| 3.5 | Stocker l'action extraite avec `type=CUSTOM`, `customTypeId`, `customTypeLabel` | MUST | S | 3.3, Epic 1 |
| 3.6 | Mettre en cache les patterns compilés par userId pour éviter une query DB par email | SHOULD | S | 3.2 |
| 3.7 | Détecter les collisions entre patterns custom et patterns natifs (logguer un warning) | SHOULD | S | 3.3 |
| 3.8 | Afficher dans l'UI quels types custom ont matché combien d'emails (stats Settings) | COULD | M | 3.5 |

**Critères d'acceptation — 3.1 à 3.5 :**
- Given: l'utilisateur a un type custom "DEPOT_GREFFE" avec mot-clé "déposer"
- When: l'extraction tourne sur un email contenant "Merci de déposer vos conclusions avant le 10 mai"
- Then: une `Action` est créée avec `type=CUSTOM`, `customTypeLabel="DEPOT_GREFFE"`, `sourceSentence` contenant la phrase, `dueDate` parsée au 10 mai

- Given: le type custom "DEPOT_GREFFE" a un seul mot-clé "déposer"
- When: l'extraction tourne sur "Vous pouvez éventuellement déposer le dossier si vous avez le temps"
- Then: aucune action n'est créée (conditionnel faible sans deadline)

---

## Epic 4 — Création depuis missing-action (flux contextuel)

Description: Depuis la page `/missing-action`, l'utilisateur peut créer un type custom en contexte — directement depuis la phrase qui a manqué — avec un choix explicite entre action ponctuelle et règle persistée.

| # | Feature | Priority | Effort | Dependencies |
|---|---------|----------|--------|--------------|
| 4.1 | Ajouter l'option "Créer un nouveau type…" dans le Select "Type d'action" du dialog | MUST | S | Epic 1 |
| 4.2 | Sous-formulaire inline : saisir le nom du type custom | MUST | S | 4.1 |
| 4.3 | Toggle explicite "Action ponctuelle / Créer une règle pour le futur" | MUST | S | 4.2 |
| 4.4 | Si "règle" : pré-remplir les mots-clés depuis la phrase sélectionnée (extraction naïve des mots significatifs ≥ 5 chars, hors stopwords FR) | MUST | M | 4.3 |
| 4.5 | Si "règle" : créer le `CustomActionType` + persister les mots-clés en base | MUST | S | 4.4, Epic 1 |
| 4.6 | Si "ponctuel" : créer l'`Action` avec `type=CUSTOM`, `customTypeLabel`, sans persister de règle | MUST | S | 4.2, Epic 1 |
| 4.7 | Confirmation post-création : toast "Action créée" + lien "Voir ce type dans Settings" si règle créée | SHOULD | S | 4.5 |
| 4.8 | Suggestions de mots-clés éditables avant validation (interface chips / tags) | SHOULD | M | 4.4 |

**Critères d'acceptation — 4.1 à 4.6 :**
- Given: l'utilisateur est dans le dialog missing-action avec la phrase "Merci de déposer vos conclusions avant le 10 mai"
- When: il sélectionne "Créer un nouveau type…", saisit "DEPOT_GREFFE", choisit "Créer une règle pour le futur", et valide
- Then: un `CustomActionType` est créé en base avec `name="DEPOT_GREFFE"`, une `Action` est créée avec `type=CUSTOM`, `customTypeLabel="DEPOT_GREFFE"`, et les futures analyses utilisent ce type

- Given: l'utilisateur choisit "Action ponctuelle"
- When: il valide
- Then: une `Action` est créée avec `type=CUSTOM`, `customTypeLabel` renseigné, et aucun `CustomActionType` n'est créé en base

---

## Epic 5 — Affichage dans l'UI

Description: Les actions de type CUSTOM s'affichent correctement dans l'ActionCard, la liste des actions et les filtres.

| # | Feature | Priority | Effort | Dependencies |
|---|---------|----------|--------|--------------|
| 5.1 | Badge texte dans ActionCard pour les types CUSTOM (label = `customTypeLabel`) | MUST | S | Epic 1 |
| 5.2 | Inclure les types CUSTOM dans les filtres de la liste actions (filtre dynamique basé sur les types présents) | MUST | S | Epic 1 |
| 5.3 | Badge avec couleur de la palette choisie par l'utilisateur | MUST | S | 1.5, 5.1 |
| 5.4 | Icône Lucide associée au type custom dans l'ActionCard | COULD | S | 1.6, 5.1 |
| 5.5 | Dans le digest email, afficher les types custom avec leur label | SHOULD | S | Epic 3 |
