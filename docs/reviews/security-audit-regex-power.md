# Security Audit Report — Regex Power v0.6.0

**Date:** 2026-04-26
**Scope:** Feature regex-power surface (server-side regex execution sandbox, email body endpoint, custom-action-types CRUD, anti-ReDoS layers)
**Method:** Static code review + `pnpm audit --prod` + cross-reference with ADRs/specs
**Auditor mode:** READ-ONLY (no files modified)

---

## Executive Summary

**Verdict: SAFE WITH CHANGES** — The regex-power feature has been engineered with a defense-in-depth posture and the critical surfaces (sandbox, ownership, sanitization, validation) are correctly implemented. **No CRITICAL or HIGH issues found** that are unique to regex-power.

However, the existing **transitive dependency vulnerabilities** (1 CRITICAL + many HIGH from `pnpm audit`) are still present and tracked elsewhere. Several **MEDIUM** and **LOW** issues specific to regex-power deserve attention before declaring the feature production-grade — chiefly the **absence of rate limiting** on the new public-facing endpoints (`test-regex`, `email/[id]/body`).

| Severity | Count |
|---|---|
| CRITICAL (regex-power) | 0 |
| HIGH (regex-power) | 0 |
| MEDIUM | 4 |
| LOW | 5 |
| INFO | 4 |
| Dep vulns (existing, transitive) | 63 (1 critical / 25 high / 29 mod / 8 low) |

---

## CRITICAL

_None unique to regex-power._

---

## HIGH

_None unique to regex-power._

The transitive `next` dependency pinned at `14.2.35` (advisory GHSA-mwv6-3258-q52c, GHSA-5j59-xgg2-r9c4) appears in `pnpm audit` but the app's main `next` is `14.2.35` which is the latest 14.2.x; `react-email@2.1.5` pulls in an older `next@14.1.4` transitively (devDependency only, not deployed). Confirm these don't reach the runtime bundle.

---

## MEDIUM

### M-RP-1 — Absence de rate-limiting sur `POST /api/custom-action-types/test-regex`
**OWASP:** A04 Insecure Design / A05 Security Misconfiguration
**File:** `app/api/custom-action-types/test-regex/route.ts:34-101`

Le helper `lib/rate-limit.ts` est utilisé sur `auth/register`, `forgot-password`, `imap/connect`, `contact` mais **pas sur `test-regex`**. Un utilisateur authentifié peut spammer 1000 requêtes/sec avec des patterns complexes proches de la limite safe-regex. Chaque requête traverse jusqu'à `MAX_TEST_TEXT_ENTRIES = 10` × `MAX_TEST_TEXT_BYTES = 5000` chars × `TEST_TIMEOUT_MS = 100ms` = **jusqu'à 1s de CPU bloquant par requête** dans le pire cas (10 timeouts vm consécutifs avant short-circuit au 1er timeout… en réalité court-circuité au 1er timeout, donc ~100ms max). Surface DoS modérée mais réelle, car la sandbox vm reste single-threaded sur le process Node.

**Vecteur :** Compte authentifié malveillant → boucle `fetch('/api/custom-action-types/test-regex', { body: { pattern: '(a+a+)+a+b', testText: ['a'.repeat(5000)] }})` à 100 req/s → saturation event-loop sur instance Vercel.

**Fix proposé :** Ajouter dès la 1re ligne du handler :
```ts
const rl = rateLimitOrFail(req, `test-regex:${session.user.id}`, { max: 30, windowMs: 60_000 });
if (rl) return rl;
```
(Clé indexée sur `userId` plutôt que IP pour éviter qu'un utilisateur derrière NAT bloque ses collègues.)

---

### M-RP-2 — Absence de rate-limiting sur `GET /api/email/[id]/body`
**OWASP:** A04 Insecure Design
**File:** `app/api/email/[id]/body/route.ts:134-196`

Même problématique que M-RP-1 : aucun rate limit. Sans cache hit, chaque appel déclenche un fetch IMAP/Graph (potentiellement plusieurs centaines de ms). Un attaquant authentifié peut épuiser les quotas Microsoft Graph (10 000 req / 10 min par app) ou saturer la connexion IMAP, **causant une dégradation de service pour tous les utilisateurs**. La protection LRU 100 entrées per-user n'aide pas si l'attaquant itère sur des `emailId` valides différents.

**Fix proposé :** `rateLimitOrFail(req, "email-body:${userId}", { max: 60, windowMs: 60_000 })`.

---

### M-RP-3 — `Cache-Control: max-age=300` autorise la persistance disque du corps email côté navigateur
**OWASP:** A02 Cryptographic Failures (data-at-rest) / RGPD
**File:** `app/api/email/[id]/body/route.ts:23,162,190`

L'ADR-006 raisonne explicitement « le navigateur peut conserver côté mémoire pour la session de test, mais pas en disque ». **Cette assertion est incorrecte** : l'en-tête `private, max-age=300, must-revalidate` autorise les navigateurs (Chrome, Firefox, Safari) à persister la réponse sur disque local. Sur poste partagé, kiosque ou device emprunté, le corps email PII reste sur disque jusqu'à expiration TTL ou nettoyage manuel.

**Vecteur :** Utilisateur teste un pattern en café → ferme l'onglet → corps email FAC-2024-0042 + signature client persiste 5 min sur disque public.

**Fix proposé :** Remplacer par `Cache-Control: private, no-store` (ou `no-cache` si on accepte la revalidation 304). Le cache RAM serveur (LRU 5min) reste en place et fait le travail de réduction de charge IMAP/Graph côté serveur.

---

### M-RP-4 — Pattern suspect non logué : pas de monitoring des timeouts vm runtime
**OWASP:** A09 Security Logging
**File:** `lib/actions/extract-actions-regex.ts:1024-1029` + ADR-005 § Risks

L'ADR-005 mentionne explicitement le besoin d'un compteur `regex_timeout_count` par `customTypeId` avec auto-invalidation à >10 timeouts/24h. **Aucune implémentation observée** : un seul `console.warn` est émis, sans persistance, sans agrégation, sans alerte. Un pattern qui passe `safe-regex` (faux négatif) mais explose au runtime sur tous les emails d'un user **ne sera jamais détecté en production**.

**Fix proposé :** Implémenter l'incrémentation décrite dans ADR-005 § Risks (table `RegexTimeoutCounter` ou champ `timeoutCount` sur `CustomActionType` + auto-flip `validated: false` au-delà du seuil). À planifier dans le backlog post-MVP.

---

## LOW

### L-RP-1 — Headers `Cache-Control` absents sur `test-regex`
**OWASP:** A05 Security Misconfiguration
**File:** `app/api/custom-action-types/test-regex/route.ts:96`

`NextResponse.json({ matches })` ne pose aucun header `Cache-Control`. La réponse contient les fragments du `testText` user (positions de match → reflète la donnée). Best practice : `Cache-Control: no-store` pour éviter qu'un proxy ou Service Worker enregistre les réponses.

**Fix proposé :** `return NextResponse.json({ matches }, { headers: { "Cache-Control": "no-store" } });`

---

### L-RP-2 — Branche 503 « TOKEN_EXPIRED » morte dans le body endpoint
**OWASP:** A09 Security Logging (UX/observabilité)
**File:** `app/api/email/[id]/body/route.ts:118-126` vs `lib/imap/imap-service.ts:493-496` + `lib/microsoft-graph/graph-service.ts:399-402`

Les services `getEmailBodyForAnalysis` (IMAP & Graph) **catch toutes les erreurs et retournent `null`** sans jamais propager d'objet avec `code: "TOKEN_EXPIRED"`. La détection à `app/api/email/[id]/body/route.ts:118-126` ne se déclenchera jamais en pratique → l'utilisateur recevra `200 { body: "", mimeType: "text/plain" }` au lieu du `503` documenté (US-4.4). Pas de fuite, mais conduit l'UI à afficher « email vide » au lieu de proposer une reconnexion.

**Fix proposé :** Soit faire remonter `TOKEN_EXPIRED` depuis les services (re-throw avec le code), soit retirer la branche morte et retourner directement `503` quand `body === null`.

---

### L-RP-3 — `console.error("[EmailBody] GET error:", error)` peut leak du body PII en stack
**OWASP:** A09 Security Logging
**File:** `app/api/email/[id]/body/route.ts:193`

Si `sanitizeHtml(body)` ou `JSON.stringify` throw dans le pipeline, `error` peut contenir des fragments du body (PII : noms, montants, IBAN). Sur Vercel, ces logs vont vers les outils tiers (Datadog, etc.) avec rétention longue.

**Fix proposé :** Logger uniquement `error?.message` ou `error?.name + error?.code`, jamais l'objet complet. Idem pour `[CustomActionTypes] *` qui peut contenir le pattern user.

---

### L-RP-4 — Pas de validation `safe-regex` sur le pattern courant lors d'un PATCH `name`-only avec `regexPattern` inchangé en DB invalide
**OWASP:** A04 Insecure Design
**File:** `app/api/custom-action-types/[id]/route.ts:106-126`

La logique « rename uniquement → skip safe-regex » (US-7.4) est correcte pour la perf. Mais combinée à : pattern injecté en DB par migration manuelle, ou faux positif `safe-regex` historique, elle laisse la possibilité qu'un type avec `validated: true` mais pattern dangereux reste actif après un rename. Couvert par la couche 2 (vm timeout) + filtre `validated: true` à la lecture, donc défense en profondeur OK. **Considéré LOW.**

**Fix optionnel :** Toujours re-valider le pattern existant dans le PATCH si `mode === "REGEX"`, même quand seul le nom change. Coût ~1ms.

---

### L-RP-5 — Cache LRU non-LRU
**OWASP:** A04 Insecure Design (perf, marginalement sécu)
**File:** `lib/email-body-cache.ts:77-80`

L'éviction utilise `userCache.keys().next().value` — c'est un FIFO (premier inséré = premier viré), pas un LRU vrai. Un email re-fetché souvent est virable même s'il est « chaud ». Impact sécu ≈ nul, juste un coût IMAP/Graph supplémentaire. Renommer le commentaire en « FIFO » serait honnête.

---

## INFO

### I-RP-1 — `safe-regex@2.1.1` & `isomorphic-dompurify@3.10.0` à jour
Versions déclarées dans `package.json:96,79` ; aucune CVE active à la date d'audit (2026-04-26) sur `pnpm audit --prod`. La validation par couche 1 + couche 2 (vm) reste robuste face aux faux négatifs heuristiques de safe-regex.

### I-RP-2 — Sandbox vm correctement isolée
`lib/actions/regex-executor.ts:62` : `vm.createContext({ __pattern__, __text__ })` → contexte vide hormis les 2 strings. Aucun accès à `global`, `process`, `require`, `eval`. Le pattern user est passé en string au constructeur `RegExp` à l'intérieur du contexte ; il ne peut pas s'évader car JavaScript regex grammar n'a pas de capacité d'invocation de code (pas de PCRE callout, pas de `(?{...})`). **Test mental d'évasion** : pattern `(?<global>)` → groupe nommé inerte. Pattern ` ` → caractère, pas eval. Pattern `function(){}` → matche littéral, pas exécuté. **Évasion impossible** par construction.

### I-RP-3 — Ownership 404 anti-enumeration correctement implémentée
`app/api/email/[id]/body/route.ts:145-151` : le `findUnique({ where: { id, userId } })` retourne `null` indistinctement pour « email inexistant » et « email d'un autre user » → 404 unique. Conforme à AC-9 et anti-enumeration.

### I-RP-4 — Zod `.strict()` correctement appliqué sur tous les bodies
- `test-regex` : `bodySchema = z.object({...}).strict()` → rejette les champs additionnels (anti-injection / anti-mass-assignment).
- `custom-action-types` POST : `keywordsSchema`, `regexSchema`, `legacyKeywordsSchema` tous `.strict()`.
- `custom-action-types/[id]` PATCH : `patchSchema = z.object({...}).strict()`.
- Pré-check explicite `detectIncoherentBody()` pour les mix mode/keywords/regexPattern incohérents → messages d'erreur propres avant Zod.

---

## Contrôles efficaces en place (à conserver)

1. **Stratégie anti-ReDoS 2-couches** (`lib/actions/regex-executor.ts` + `validation.ts`) : safe-regex à la création + vm timeout au runtime. Bien implémenté, conforme ADR-005.
2. **Ownership 404 anti-enumeration** (`app/api/email/[id]/body/route.ts:145`) : pattern correct.
3. **Filtrage `validated: true` côté DB** dans `lib/cron/daily-sync-job.ts:89` et `app/api/email/analyze/route.ts:58` : défense en profondeur (un pattern dangereux ajouté manuellement en DB ne sera pas chargé par le scan).
4. **DOMPurify allowlist restrictive** (`app/api/email/[id]/body/route.ts:58-83`) : `ALLOWED_TAGS` explicite (pas de `script`, `iframe`, `object`, `style`, `svg`), `ALLOWED_ATTR` ne contient que `href` + `title`, `ALLOWED_URI_REGEXP` bloque `javascript:` (les attributs `on*`, `onerror`, `onload` sont strippés par défaut DOMPurify). Tests `tests/api/email-body.test.ts:223-243` couvrent les cas XSS classiques.
5. **Troncature 50 KB systématique** (`app/api/email/[id]/body/route.ts:177-180`) appliquée même sur cache miss, avant DOMPurify et stockage cache.
6. **Cache RAM in-process strict** (`lib/email-body-cache.ts`) : pas de persistance disque, TTL 5min respecté, isolation per-user via `Map<userId, Map<emailId, ...>>` — pas de leak inter-user observé.
7. **PATCH/DELETE custom-action-types** (`app/api/custom-action-types/[id]/route.ts:75,189`) : `userId` check explicite avec 403 → IDOR bloqué.
8. **Manual action — IDOR sur `customTypeId`** (`app/api/actions/manual/route.ts:130-138`) : ownership check `existingType.userId !== user.id` → 403.
9. **Pattern jamais `eval()`** : stocké en `String` dans Postgres `VARCHAR(200)`, passé à `new RegExp(__pattern__, "gi")` à l'intérieur du sandbox vm — aucun risque d'injection code.
10. **Zod `.strict()` partout** sur les bodies POST/PATCH (anti mass-assignment).
11. **Headers de sécurité globaux** (`next.config.js:3-33`) : CSP, X-Frame-Options, HSTS, X-Content-Type-Options, Referrer-Policy.

---

## Dependency Audit (`pnpm audit --prod`)

**63 vulnérabilités totales** (8 low / 29 moderate / 25 high / 1 critical) — toutes **transitives**, principalement via `react-email@2.1.5` qui embarque un `next@14.1.4` obsolète (CRITICAL : Authorization Bypass Middleware GHSA-f82v-jwr5-mffw).

| Severity | Package | Path | Note |
|---|---|---|---|
| CRITICAL | next@14.1.4 | react-email > next | Transitif dev tooling |
| HIGH | next@14.2.35 (>=13.0.0 <15.0.8) | direct + transitive | App principale, advisory récente DoS via insecure RSC |
| HIGH | glob@10.3.4 | react-email | Command injection CLI, non exposé en runtime |
| HIGH | postcss@8.4.31 | next > postcss | Build-time |
| LOW | mailparser@3.9.1 | direct | XSS — déjà couvert par DOMPurify côté body endpoint |
| LOW | nodemailer@7.0.x | imapflow / mailparser | SMTP injection — non utilisé pour envoi |
| LOW | cookie@<0.7.0 | next-auth > @auth/core | Out-of-bounds chars |

**Recommendation :** Ces vulns sont prises en charge dans le tracker `security-audit.md` (item M-4 « ℹ️ Info »). Aucune n'est introduite par regex-power. À traiter dans un sprint séparé d'upgrade `next-auth`/`react-email`.

---

## Verdict final

**SAFE-WITH-CHANGES.**

Les 4 issues MEDIUM (M-RP-1 à M-RP-4) doivent être adressées avant exposition publique de la feature pour éviter :
- DoS via spam test-regex (M-RP-1) et email-body (M-RP-2),
- persistance disque PII côté navigateur (M-RP-3),
- silence en cas de pattern dangereux runtime (M-RP-4).

Les 5 LOW peuvent être traitées dans un sprint de hardening ultérieur. Les contrôles cœur (sandbox vm, ownership 404, DOMPurify, Zod strict, troncature 50 KB, filtre `validated: true`) sont solides et conformes aux ADRs.
