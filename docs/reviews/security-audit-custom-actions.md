# Security Audit — custom-actions

**Phase 8 — AMC Lifecycle**
**Périmètre :** commits `0f9c6e0..8802f5f`
**Auditeur :** Security Auditor agent (read-only, OWASP Top 10)

## Synthèse

- **Verdict** : SECURE (avec 1 finding LOW à corriger côté config + recos transverses)
- **CRITICAL** : 0
- **HIGH** : 0
- **MEDIUM** : 0
- **LOW** : 2
- **INFO** : 4
- **Vulnérabilités dépendances** : 1 critical / 34 high / 30 moderate / 8 low — **toutes héritées (transitives), aucune introduite par cette feature**

La feature custom-actions est **bien conçue côté sécurité**. Auth, ownership IDOR et validation Zod sont systématiques et corrects. Le risque ReDoS — la vraie cible d'inquiétude — est **proprement neutralisé** par `escapeRegex` + bornes `MAX_KEYWORD_LENGTH=60` / `MAX_KEYWORDS=50`. Aucune régression de sécurité versus les patterns existants.

---

## Findings

### CRITICAL · HIGH · MEDIUM
*(aucun)*

### LOW

#### LOW-1 — Mass-assignment toléré (Zod `.strict()` absent)
**Fichiers :**
- `app/api/custom-action-types/route.ts:24-28`
- `app/api/custom-action-types/[id]/route.ts:23-28`

**OWASP :** A04 / A08

Les schémas Zod ne sont pas en `.strict()`. Un body avec `userId` ou `role` injecté ne lève pas d'erreur 422.

**En pratique l'exploitation est bloquée** : le code construit explicitement `updateData` champ par champ → `userId` injecté est ignoré. Et Prisma rejetterait de toute façon les champs hors schéma.

**Risque résiduel** : un dev futur qui ferait `prisma.customActionType.update({ data: parsed.data })` (spread direct) introduirait un IDOR. `.strict()` rend le contrat explicite côté API.

**Fix** :
```ts
const createSchema = z.object({
  name: z.string().trim().min(1).max(MAX_TYPE_NAME_LENGTH),
  keywords: z.array(z.string().trim()).min(1).max(MAX_KEYWORDS),
  color: z.enum(CUSTOM_ACTION_COLORS).optional(),
}).strict();
```

#### LOW-2 — Migration Postgres non-transactionnelle : runbook informel
**Fichier :** `prisma/migrations/20260425_custom_action_types/migration.sql:1-4`

**OWASP :** A08

`ALTER TYPE "ActionType" ADD VALUE IF NOT EXISTS 'CUSTOM'` doit tourner avant que le code applicatif ne soit servi. Le commentaire `-- non-transactionnel` est informel.

**Fix recommandé** : documenter un runbook explicite dans `docs/features/custom-actions.md` :
1. `prisma migrate deploy` doit terminer avant que le nouveau code soit servi
2. Pas de rolling deploy avec ancien code lisant la nouvelle DB et nouveau code lisant l'ancienne

Optionnel : split la migration en 2 fichiers pour forcer Prisma à les exécuter dans des transactions séparées.

---

### INFO

- **INFO-1** Logs serveur exemptés de PII : OK (sauf `lib/session.ts:18` hors scope, à noter pour RGPD si log externe)
- **INFO-2** `userExclusions` SUBJECT utilise `String.includes()` → pas de surface ReDoS
- **INFO-3** Dédoublonnage des actions custom basé sur `(type, title, sourceSentence)` → contraintes Prisma garantissent l'intégrité
- **INFO-4** Pas de rate limiting sur POST custom-action-types → la limite hard `MAX_TYPES_PER_USER=10` joue le garde-fou anti-abuse. Risque négligeable au MVP.

---

## Bonnes pratiques observées

1. **Auth check systématique** — `auth()` + `session?.user?.id` au début de chaque handler (4/4 routes)
2. **Ownership check avant mutation** — PATCH/DELETE font une lecture préalable + comparaison `userId`
3. **IDOR cas A vérifié** — `manual/route.ts:136` rejette correctement avec 403
4. **Anti-ReDoS bien dimensionné** :
   - `escapeRegex(str)` échappe `.* + ? ^ $ { } ( ) | [ ] \`
   - `MAX_KEYWORD_LENGTH=60` + `MAX_KEYWORDS=50` → regex finale max ~3000 chars, alternation linéaire non-pathologique
   - Validation appliquée 3 fois (POST + PATCH type + POST manual cas B)
5. **SQL injection : aucune query brute** — tout passe via Prisma (`grep $queryRaw|$executeRaw` → 0 résultat)
6. **Snapshot integrity** — `customTypeLabel/Color` non exposés dans aucun endpoint PATCH d'Action existant → snapshot immuable côté API
7. **Transaction atomique cas B** — pas d'état orphelin si l'un échoue
8. **Validation BigInt safe** — try/catch autour de `BigInt(imapUIDStr)`
9. **Cascade delete cohérente** — `User → CustomActionType (Cascade)` + `CustomActionType → Action (SetNull)`
10. **Codes HTTP sémantiquement corrects** — 422/400/401/403/404/409 utilisés à bon escient

---

## Dependency Audit (`pnpm audit`)

**Résumé global du projet :**
- 1 CRITICAL : `next@14.1.4` transitive via `react-email@2.1.5` (Authorization Bypass Middleware GHSA-f82v-jwr5-mffw, patché en 14.2.25)
- 34 HIGH, 30 moderate, 8 low

**Aucune vulnérabilité introduite par la feature custom-actions.** Le `next` direct du projet est `14.2.35` → le CRITICAL ne touche pas le runtime applicatif (uniquement l'instance embarquée dans `react-email`).

**Recommandation hors scope** : mettre à jour `react-email` vers ≥3.x.

---

## Recommandations transverses

1. **Adopter `.strict()` partout** dans les schémas Zod du projet (à standardiser)
2. **404 vs 403 sur ownership** : envisager 404 dans les deux cas (non-existant ET non-owné) pour aligner avec OWASP API4 (Resource Enumeration)
3. **Rate limiting global** : Upstash Ratelimit / Vercel KV pour toutes les routes mutantes
4. **Logs structurés** (pino/winston) avec `userId` hashé + `requestId` pour monitoring sécurité
5. **Tests d'intégration sécurité dédiés** :
   - PATCH par autre user → 403
   - DELETE par autre user → 403
   - cas A avec customTypeId d'autre user → 403
   - Body avec champs inconnus (post-fix `.strict()`) → 422
6. **CSP & headers HTTP** — audit dédié à planifier
