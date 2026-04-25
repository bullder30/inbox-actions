# Architecture — Custom Action Types (Phase 2)

Phase 2 du cycle AMC pour la feature "Actions personnalisées utilisateur".
Les décisions sont alignées sur le [Big Picture](../big-picture/) (Phase 1) et seront déclinées en specs Given/When/Then en [Phase 3](../features/).

## Documents

| Doc | Contenu |
|---|---|
| [`c4-diagrams.md`](./c4-diagrams.md) | Diagrammes Context, Container, Component (Mermaid) |
| [`data-model.md`](./data-model.md) | ERD + extrait Prisma + invariants + palette couleurs |
| [`api-contracts.md`](./api-contracts.md) | 4 endpoints CRUD + extension `manual` + codes HTTP |
| [`patterns.md`](./patterns.md) | Patterns choisis (Strategy, Snapshot, etc.) + anti-patterns |
| [`adrs/adr-001-schema-custom-action-type.md`](./adrs/adr-001-schema-custom-action-type.md) | Enum CUSTOM + table dédiée + snapshot label/color |
| [`adrs/adr-002-pattern-compilation.md`](./adrs/adr-002-pattern-compilation.md) | Compilation regex à la volée (pas de cache MVP) |
| [`adrs/adr-003-slug-generation.md`](./adrs/adr-003-slug-generation.md) | Slug déterministe + 409 sur conflit (pas d'auto-suffixe) |
| [`adrs/adr-004-extractor-integration.md`](./adrs/adr-004-extractor-integration.md) | Extension non-cassante de la signature `extractActionsFromEmail` |

## Gate Phase 2 — statut

| Critère | Statut |
|---|---|
| ADRs marqués Accepted | ✅ 4/4 |
| C4 diagrams Mermaid valides | ✅ (testables sur https://mermaid.live) |
| ERD couvre toutes les entités | ✅ (User, Action étendue, CustomActionType, UserExclusion) |
| Contrats API couvrent les MUST | ✅ (CRUD complet + extension `manual` cas A et B) |

**Phase 3 — Spec** (`/amc:spec custom-actions`) peut démarrer.
