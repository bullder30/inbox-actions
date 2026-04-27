# Feature Spec — Custom User Action Types

**Status: shipped in v0.5.0** — see [custom-actions.md](./custom-actions.md) (FR, canonical) for the full Given/When/Then spec, edge cases and acceptance criteria.

This English summary captures the essentials for non-French speakers contributing to or reviewing the feature.

---

## 1. Context

The 5 native action types (`SEND | CALL | FOLLOW_UP | PAY | VALIDATE`) don't cover every profession. Without user-defined types, users were stuck on "Missing an action?" loops for the same recurring patterns.

### Personas covered
- **Marc** (solo lawyer) — types like "Court filing", "Client meeting", "Case law search"
- **Léa** (freelance dev) — types like "Code review", "Production deploy", "Daily stand-up"
- **Camille** (team manager) — types like "1-on-1", "Budget approval", "Weekly report"

### Product principle preserved
**Transparency + determinism** — explainable rules, no AI black-box.

---

## 2. Scope (5 epics)

| Epic | Description |
|---|---|
| **1. Data model** | New table `CustomActionType` + enum value `CUSTOM` + snapshot fields on `Action` |
| **2. Settings CRUD** | Full UI to list / create / edit / delete custom types (max 10 / user) |
| **3. Extractor integration** | Pipeline detects custom keywords alongside native types, with same exclusion rules and deduplication |
| **4. Missing-action creation** | When manually creating an action from `/missing-action`, user can pick "Create new type" — one-shot or persisted as a rule |
| **5. ActionCard badge** | Custom badge with snapshot label + color, both `default` and `compact` variants |

---

## 3. User Stories (summary)

- **US-1** List my custom types in Settings (with empty state)
- **US-2** Create a new custom type (name + keywords + color picker)
- **US-3** Edit an existing type (name, keywords, color, active status)
- **US-4** Delete a type (warns about historical actions — preserved via snapshots)
- **US-5** Custom keywords detected during email scan with same gating logic as natives
- **US-6** Use existing custom type when manually creating an action
- **US-7** Create a new custom type on-the-fly from `/missing-action` (one-shot or persisted)
- **US-8** ActionCard renders the custom badge with snapshot color/label

Full Given/When/Then scenarios in the [FR spec](./custom-actions.md#2-user-stories).

---

## 4. Acceptance Criteria (summary)

| ID | Criterion |
|---|---|
| AC-1 | Limit 10 custom types / user enforced server-side |
| AC-2 | Slug is deterministic (`name → slug` pure function, FR stop-words removed) |
| AC-3 | Unique constraint `(userId, slug)` returns 409 on POST/PATCH conflict |
| AC-4 | Cross-user access returns 403 on PATCH/DELETE |
| AC-5 | DELETE preserves historical Actions via `customTypeLabel` + `customTypeColor` snapshots |
| AC-6 | Deactivating a type (isActive=false) excludes it from extraction without deleting it |
| AC-7 | Extractor dedup: if a custom keyword and a native pattern both match, native wins |
| AC-8 | Custom keywords ignored under conditional phrases ("if you can", "when you have time") |
| AC-11 | Custom snapshots frozen at extraction time — later type rename doesn't affect historical actions |
| AC-12 | Manual action with `persistAsRule=true` runs in a Prisma transaction (count + create) |
| AC-13 | Backwards compatibility: existing actions without custom type render unchanged |

---

## 5. Impacted Files

| File | Action |
|---|---|
| `prisma/schema.prisma` | MODIFY — `CUSTOM` enum + `CustomActionType` table + snapshots on `Action` |
| `lib/actions/extract-actions-regex.ts` | MODIFY — load active custom types, compile keyword patterns, snapshot at extraction |
| `lib/custom-action-types/validation.ts` | CREATE — name/keywords/color validators (Zod) |
| `lib/custom-action-colors.ts` | CREATE — 8-color palette + Tailwind class mapping |
| `lib/slug.ts` | CREATE — `nameToSlug(name)` pure function |
| `lib/stoplist-fr.ts` | CREATE — minimal FR stop-words list (~50 words) |
| `app/api/custom-action-types/route.ts` | CREATE — GET (list) + POST (create) |
| `app/api/custom-action-types/[id]/route.ts` | CREATE — PATCH (update) + DELETE |
| `app/api/actions/manual/route.ts` | MODIFY — handle `customTypeId` (case A) + `persistAsRule` (case B with transaction) |
| `app/(protected)/settings/page.tsx` | MODIFY — render `<CustomActionTypesSection />` |
| `components/settings/custom-action-types-section.tsx` | CREATE — list + create/edit/delete dialogs |
| `app/(protected)/missing-action/page.tsx` | MODIFY — extended select with "Create new type" option |
| `components/actions/action-card.tsx` | MODIFY — render custom badge from snapshots |

---

## 6. API Contract — summary

Full details in [`docs/architecture/api-contracts.md`](../architecture/api-contracts.md).

| Endpoint | Method | Status codes |
|---|---|---|
| `/api/custom-action-types` | GET | 200, 401 |
| `/api/custom-action-types` | POST | 201, 400 (limit), 409 (slug), 422 (validation), 401 |
| `/api/custom-action-types/[id]` | PATCH | 200, 403 (ownership), 404, 409, 422, 401 |
| `/api/custom-action-types/[id]` | DELETE | 200, 403, 404, 401 |
| `/api/actions/manual` (extended) | POST | 201, 400, 403, 422, 401 |

---

## 7. Data Model Changes — summary

Full details in [`docs/architecture/data-model.md`](../architecture/data-model.md).

| Entity | Change |
|---|---|
| `ActionType` (enum) | + `CUSTOM` value |
| `CustomActionType` (table) | NEW: id, userId, name, slug, keywords[], color, isActive, timestamps + `@@unique([userId, slug])` + `@@index([userId, isActive])` |
| `Action` | + `customTypeId String?` (FK SetNull) + `customTypeLabel String?` (snapshot) + `customTypeColor String?` (snapshot) |
| `User` | + relation `customActionTypes` |

---

## 8. Out of Scope (V1 MVP)

- Marketplace of business templates (V2)
- AI-light pattern suggestions from sentence (out of deterministic philosophy)
- Multi-language keywords (FR-only, like native extractor)
- Retroactive re-scan after type modification (changes only apply to future emails — see ADR-001)
- Filter by custom type in `/actions` (V1.1)
- Sharing / export / import of types between users (V2)
- LRU cache for compiled patterns (YAGNI at MVP — 10 × 50 keywords compile in < 1ms)
- Auto-suffix on slug conflict (ADR-003: transparency > magic)
- Type versioning / rollback (V2)

---

## See also

- **Canonical FR spec**: [`docs/features/custom-actions.md`](./custom-actions.md) — full Given/When/Then with edge cases
- **Architecture**: [`docs/architecture/`](../architecture/) — ADRs 001-004, ERD, API contracts
- **Big picture**: [`docs/big-picture/`](../big-picture/) — vision, personas, epics MoSCoW
- **Regex Power extension** (v0.6): [`docs/features/regex-power.en.md`](./regex-power.en.md)
