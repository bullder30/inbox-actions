# Feature Spec — Regex Power & Visual Validation

**Status: shipped in v0.6.0** — see [regex-power.md](./regex-power.md) (FR, canonical) for the full Given/When/Then spec, edge cases and acceptance criteria.

This English summary captures the essentials for non-French speakers contributing to or reviewing the feature. Extension of [custom-actions.en.md](./custom-actions.en.md) (v0.5.0).

---

## 1. Context

Keywords cover basic needs but not structured patterns (invoice numbers, ticket references, business formats). The advanced regex mode + inline visual validation positions Inbox Actions as a **pro tool** vs AI black-box competitors. It preserves the product principle — **transparency + determinism** — at its purest: a regex is the perfect embodiment (zero magic, 100% explainable, debuggable).

### Personas
- **Léa** (freelance dev) — power user, regex literate, wants 100% control (`PR #\d+`, `merge[d]?\s+request`)
- **Camille** (manager) — non-technical, uses pre-built business templates (1-on-1, daily stand-up, budget approval)
- **Sophie** (accountant) — non-technical, depends on accounting templates (invoice IDs, quote refs, transfers)

---

## 2. Scope (4 epics)

| Epic | Description |
|---|---|
| **1. Extended DB model** | New enum `CustomActionTypeMode { KEYWORDS, REGEX }` + columns `regexPattern`, `validated` on `CustomActionType` |
| **2. Settings UI** | KEYWORDS/REGEX toggle on create/edit dialog + inline test zone with live highlighting |
| **3. Missing-action UI** | Live regex preview against the **full email body** (sanitized HTML, 50 KB max) |
| **4. Business templates** | Static catalog of ~12-15 ready-to-use patterns grouped by category (Accounting / Legal / IT / HR) |

---

## 3. Locked Decisions (4 from Big Picture phase)

| ID | Decision |
|---|---|
| **D1** | **Anti-ReDoS: 2-layer strategy** — `safe-regex` static check on POST/PATCH (rejects dangerous patterns at creation) + `vm.runInNewContext` runtime sandbox with 200ms timeout (skip & log if explosion at scan time) |
| **D2** | **Default mode = KEYWORDS, opt-in toggle to REGEX** — beginner-friendly default, no auto-detection |
| **D3** | **Visualization: full-scope** — both Settings test zone (3 sample sentences) AND `/missing-action` preview against the actual email body |
| **D4** | **Business templates in MVP** — accelerates non-tech users adoption, static file (no DB) |

See [`docs/architecture/regex-power/adrs/`](../architecture/regex-power/adrs/) — ADR-005 (anti-ReDoS), ADR-006 (email body endpoint), ADR-007 (server-side regex execution).

---

## 4. User Stories (summary)

- **US-1** Toggle into REGEX mode on type dialog (create/edit)
- **US-2** Create a custom REGEX type with safe-regex validation (rejects `(.*)*`, `(a+)+`, syntax errors, > 200 chars)
- **US-3** Test a regex in Settings test zone — paste sample text, see ranges highlighted with `<mark>`, debounce 300ms, in-memory cache
- **US-4** Visualize matches in a real email body on `/missing-action` — fetch via `/api/email/[id]/body` (sanitized, 50 KB max, 5-min cache)
- **US-5** Detect regex matches at scan time — runtime vm timeout protects pipeline, type skipped on explosion
- **US-6** Pick a business template from grouped Popover (Accounting/Legal/IT/HR) — pre-fills pattern + suggests name + theme color
- **US-7** Edit existing type — switch mode, re-validate pattern on PATCH
- **US-8** Snapshot integrity — pattern is type-level (not snapshotted on Action), but label/color stay frozen on historical actions

Full Given/When/Then scenarios in the [FR spec](./regex-power.md#2-user-stories).

---

## 5. Acceptance Criteria (15)

| ID | Criterion |
|---|---|
| AC-1 | Dangerous ReDoS pattern rejected at creation (`(a+)+` → 422) |
| AC-2 | Pattern > 200 chars rejected (Zod 422) |
| AC-3 | Invalid syntax rejected (`(unclosed` → 422) |
| AC-4 | `validated: true` iff safe-regex passes |
| AC-5 | Extractor only loads types with `validated: true` AND `isActive: true` |
| AC-6 | Runtime timeout 200ms → skip email + scan continues |
| AC-7 | `test-regex` returns correct `[start, end]` ranges |
| AC-8 | `test-regex` returns 408 on timeout |
| AC-9 | `email body` endpoint enforces ownership (cross-user → 404) |
| AC-10 | Email body truncated to 50 KB (`truncated: true` flag) |
| AC-11 | HTML email sanitized (DOMPurify strips `<script>`, `<iframe>`, etc.) |
| AC-12 | Email body cached 5 min in-memory (2nd call < TTL = 0 provider fetch) |
| AC-13 | KEYWORDS mode stays backwards-compatible (259 v0.5 tests stay green) |
| AC-14 | All business templates pass safe-regex |
| AC-15 | TypeScript strict OK (`tsc --noEmit` exit 0) |

---

## 6. Impacted Files

| File | Action |
|---|---|
| `prisma/schema.prisma` | MODIFY — `CustomActionTypeMode` enum + 3 columns + extended index |
| `prisma/migrations/20260426000000_regex_power/migration.sql` | CREATE |
| `lib/actions/regex-executor.ts` | CREATE — `safelyExecuteRegex()` via `vm` + `isPatternSafe()` via safe-regex |
| `lib/actions/extract-actions-regex.ts` | MODIFY — switch on mode + sandbox + skip email on timeout |
| `lib/regex-templates.ts` | CREATE — catalog of 12+ templates per category |
| `lib/email-body-cache.ts` | CREATE — Map LRU per-user, TTL 5 min |
| `lib/custom-action-types/validation.ts` | MODIFY — `validateRegexPattern(pattern)` |
| `app/api/custom-action-types/route.ts` | MODIFY — POST with discriminated union mode + safe-regex check |
| `app/api/custom-action-types/[id]/route.ts` | MODIFY — PATCH idem |
| `app/api/custom-action-types/test-regex/route.ts` | CREATE — POST endpoint test zone |
| `app/api/email/[id]/body/route.ts` | CREATE — GET email body (DOMPurify, 50 KB max, 5-min cache) |
| `components/settings/custom-action-types-section.tsx` | MODIFY — Mode toggle + regex field + inline test zone |
| `components/settings/regex-template-picker.tsx` | CREATE — Popover with templates by category |
| `components/actions/match-highlighter.tsx` | CREATE — text + ranges → `<mark>` render |
| `components/actions/email-body-preview.tsx` | CREATE — fetch `/api/email/[id]/body`, supports pattern (debounced) or keywords (local) |
| `app/(protected)/missing-action/page.tsx` | MODIFY — live preview + debounce 300ms |

---

## 7. API Contract — summary

Full details in [`docs/architecture/regex-power/api-contracts.md`](../architecture/regex-power/api-contracts.md).

| Endpoint | Method | Status codes |
|---|---|---|
| `/api/custom-action-types/test-regex` | POST | 200 / 401 / 408 / 422 |
| `/api/email/[id]/body` | GET | 200 / 401 / 404 / 502 / 503 |
| `/api/custom-action-types` | POST (extended) | 201 / 400 / 401 / 409 / 422 |
| `/api/custom-action-types/[id]` | PATCH (extended) | 200 / 401 / 403 / 404 / 409 / 422 |

---

## 8. Data Model Changes — summary

Full details in [`docs/architecture/regex-power/data-model.md`](../architecture/regex-power/data-model.md).

| Entity | Change |
|---|---|
| `CustomActionTypeMode` (enum) | NEW — `KEYWORDS | REGEX` |
| `CustomActionType.mode` | NEW — default `KEYWORDS` |
| `CustomActionType.regexPattern` | NEW — `String?` max 200 chars |
| `CustomActionType.validated` | NEW — `Boolean` default `false` |
| `@@index([userId, isActive, validated])` | NEW — extractor filter |

Migration: existing types in KEYWORDS auto-marked `validated: true` (backwards-compatible).

---

## 9. Out of Scope (V1 MVP)

- `re2` native lib (serverless compatibility, see ADR-005)
- Client-side regex execution (consistency + security, see ADR-007)
- Templates in DB (static file at MVP)
- Retroactive re-scan after pattern change
- Sharing / marketplace of patterns between users (V2)
- Regex profiler (V2)
- Named capture groups exposed in Action title (V2)
- Auto-detection regex vs keywords on a single field (D2 explicit)
- Default support for `\p{...}` Unicode property escapes (user must add the flag manually)

---

## 10. Delivery Status (v0.6.0)

### Backend (`ba9238f` → `29726be`)
- Phase 4 RED — 53 failing tests
- Phase 5 GREEN — 312 tests green (8 NEW + 6 MODIFY files)
- Phase 6 Refactor — extracted helpers
- Phase 7 Doc — JSDoc + CLAUDE.md update
- Phase 8 Review + Security audit (1 CRITICAL + 3 HIGH fixed, 4 MEDIUM in backlog)
- Phase 9 consolidated smoke test (`docs/reviews/smoke-test-regex-power.md`)
- Prisma migration renamed `20260426000000_regex_power` (lexicographic order fix)

### UI — 3 steps (`840af7e`, `4997ac6`, `ef8461c`)
- **Step 1/3** — Settings: KEYWORDS/REGEX toggle + pattern field + inline test zone
- **Step 2/3** — Business templates picker (Popover grouped by category, 15 templates)
- **Step 3/3** — Missing-action: live email body preview + mode toggle + RegexTemplatePicker + backend extension case B in REGEX mode

### Post-launch fixes
- Correct parsing of `/api/test-regex` response (helper `parseTestRegexResponse`, commit `48a48d2`)
- 7 UX polish fixes (`8675b5c`)

### Final metrics
- **Tests**: 371/371 green
- **AC coverage**: 15/15
- **Backward compat regression**: 0 (259 v0.5.0 tests stay green)
- **Production build**: OK

### Post-MVP backlog (hardening sprint)
- Rate-limit `test-regex` and `email/[id]/body` endpoints (M-RP-1, M-RP-2 from security audit)
- `Cache-Control: no-store` on email body (M-RP-3, GDPR)
- Counter on vm runtime timeout + auto-flip `validated: false` (M-RP-4)
- True LRU instead of FIFO on email body cache (MEDIUM-4)
- Global user bound on email body cache (MEDIUM-5)
- Sharing / marketplace of regex templates (V2)
- Retroactive email re-scan after pattern change (V2)

---

## See also

- **Canonical FR spec**: [`docs/features/regex-power.md`](./regex-power.md) — full Given/When/Then with edge cases
- **Architecture**: [`docs/architecture/regex-power/`](../architecture/regex-power/) — ADRs 005-007, ERD, API contracts
- **Big picture**: [`docs/big-picture/regex-power/`](../big-picture/regex-power/) — vision, personas, epics MoSCoW
- **Base feature** (v0.5): [`docs/features/custom-actions.en.md`](./custom-actions.en.md)
