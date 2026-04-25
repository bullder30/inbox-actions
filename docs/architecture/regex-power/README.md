# Architecture — Regex Power & Validation Visuelle (Phase 2)

Phase 2 du cycle AMC pour la feature regex-power (extension de custom-actions v0.5.0).
Décisions structurelles alignées sur le [Big Picture regex-power](../../big-picture/regex-power/).

## Documents

| Doc | Contenu |
|---|---|
| [`c4-diagrams.md`](./c4-diagrams.md) | C4 mis à jour (Container + Component avec RegexExecutor + email body endpoint) |
| [`data-model.md`](./data-model.md) | Extension `CustomActionType` (mode + regexPattern + validated) + invariants |
| [`api-contracts.md`](./api-contracts.md) | 2 nouveaux endpoints (test-regex, email body) + extension POST/PATCH |
| [`patterns.md`](./patterns.md) | Strategy étendu, Sandbox/Bulkhead, Server-side validation, Cache TTL |
| [`adrs/adr-005-anti-redos-strategy.md`](./adrs/adr-005-anti-redos-strategy.md) | Stratégie 2-couches : safe-regex (gate) + vm timeout 200ms (runtime) |
| [`adrs/adr-006-email-body-endpoint.md`](./adrs/adr-006-email-body-endpoint.md) | GET `/api/email/[id]/body` : ownership + RGPD + tronquage 50KB + cache LRU |
| [`adrs/adr-007-server-side-regex-execution.md`](./adrs/adr-007-server-side-regex-execution.md) | Pas de regex côté client (cohérence + sécurité) |

## Gate Phase 2 — statut

| Critère | Statut |
|---|---|
| 3 ADRs Accepted (ADR-005, ADR-006, ADR-007) | ✅ |
| C4 diagrams Mermaid valides | ✅ (testables sur https://mermaid.live) |
| ERD couvre l'extension du modèle | ✅ (`mode` + `regexPattern` + `validated`) |
| Contrats API couvrent les 4 epics MUST | ✅ |

**Phase 3 — Spec** (`/amc:spec regex-power`) peut démarrer.
