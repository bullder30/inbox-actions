# Patterns — Custom Action Types

Documentation des patterns architecturaux choisis et où ils s'appliquent dans l'implémentation.

| Pattern | Application | Justification |
|---|---|---|
| **Repository implicite via Prisma** | Toutes les opérations DB (CRUD `CustomActionType`, lecture `Action`) | Convention existante du projet, pas de couche séparée. Évite le ballast d'un Repository pattern formel pour un projet à 1 dev. |
| **Strategy** (extracteurs natifs vs custom) | `extractActionsFromEmail()` orchestre `extractNativeActions()` + `extractCustomActionsFromEmail()` avec mêmes contrats | Permet d'ajouter d'autres extracteurs (ex. LLM en V2) sans toucher l'orchestrateur ni les callers. |
| **Snapshot pattern** (event sourcing-light) | `customTypeLabel` et `customTypeColor` figés sur `Action` au moment de la création | Préserve l'historique lisible, immune aux modifications futures du type custom (rename, delete, recolor). Cohérent avec la philosophie produit "déterminisme + transparence". |
| **Server-driven validation** | Slug, limite 10, unicité, stoplist FR validés uniquement côté API (Zod + Prisma) | Évite la duplication client/server. Le client UI peut reporter les erreurs reçues dans des toasts. |
| **Optimistic UI (existant, à réutiliser)** | SWR `mutate` sur la création/édition/suppression de types custom dans Settings | Cohérence UX avec le reste de l'app (pattern déjà en place sur ActionCard). |
| **Constants Map UI** | Palette 8 couleurs comme constantes (`lib/custom-action-colors.ts`) avec mapping `color → { bgClass, textClass }` | Évite les hex hardcodés. Cohérent avec la philosophie design system unifié récemment livrée (`text-brand`, `.bg-brand-gradient`). |
| **Pure function extraction** | `extractActionsFromEmail()` reste pur (signature explicite : context, exclusions, customTypes) | Testable sans mock DB. Les callers chargent les données et les injectent. |
| **Transaction Prisma** | Création d'un type custom ET d'une Action en une seule fois (`POST /api/actions/manual` cas B avec `persistAsRule: true`) | Garantit l'atomicité : si la création du type échoue (limite, conflit), l'Action n'est pas créée non plus. |

## Conventions de nommage à respecter

- Slug d'un type custom : `lower_snake_case` (généré par `nameToSlug()`)
- Couleur : minuscule, valeur de l'enum admise
- Label affiché : strictement le `name` saisi par l'user (pas de transformation)
- Composants React : `CustomActionTypesSection`, `CustomActionTypeCard`, `CustomActionTypeDialog` (pluriel pour la section, singulier pour le dialog)
- API routes : `app/api/custom-action-types/...` (kebab-case dans l'URL)
- Helper file : `lib/custom-action-colors.ts`, `lib/slug.ts`

## Anti-patterns à éviter

- ❌ Stocker la palette de couleurs en DB (overkill — 8 valeurs constantes côté code suffit)
- ❌ Permettre des regex libres en keywords (ReDoS — uniquement keywords mots simples avec échappement)
- ❌ Cache LRU des patterns compilés (YAGNI au MVP, voir ADR-002)
- ❌ Couche Repository / DTO / Service séparée (overengineering pour ce projet)
- ❌ Re-scan rétroactif des emails après modification d'un type (modification = règle pour le futur uniquement)
- ❌ Auto-suffixe sur conflit de slug (transparence > magie, voir ADR-003)
- ❌ Permettre la création de types custom depuis ActionCard (UX confus — uniquement Settings et missing-action, comme spécifié dans le Big Picture)
