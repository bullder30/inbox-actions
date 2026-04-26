# Code Review — Regex Power feature (v0.6.0)

**Date :** 2026-04-26
**Scope :** Backend regex-power (Phases 5+6 commits 9996103, 2cf3acd)
**Reviewer :** code-review agent (AMC lifecycle Phase 8)

---

## Résumé exécutif

**Verdict global : APPROVE-WITH-CHANGES**

L'implémentation respecte les ADRs (anti-ReDoS 2 couches, ownership 404, sandbox vm, cache TTL, DOMPurify) et tous les ACs principaux. Les 312 tests passent, le lint est propre (1 warning préexistant hors regex-power), et `tsc --noEmit` ne rapporte aucune erreur. Les patterns architecturaux (Strategy, Sandbox, Discriminated Union) sont bien appliqués.

**Cependant, 1 bug CRITICAL existe** : la route `/api/actions/manual` (cas B `persistAsRule: true`) crée des `CustomActionType` sans positionner `validated: true`. Le défaut Prisma étant `false`, ces types seront **systématiquement exclus** par le filtre `validated: true` du scan automatique (`daily-sync-job.ts` + `analyze/route.ts`). Régression silencieuse pour les utilisateurs qui créent leurs types depuis la page `/missing-action`.

| Sévérité | Nombre |
|---|---|
| CRITICAL | 1 |
| HIGH | 3 |
| MEDIUM | 6 |
| LOW | 5 |
| INFO | 4 |

---

## Issues

### CRITICAL

**[CRITICAL-1] Manual route ne définit pas `validated: true` sur les nouveaux CustomActionType**
- Fichier : `app/api/actions/manual/route.ts:196-204`
- Description : la transaction du cas B (`persistAsRule: true`) crée un `CustomActionType` sans champs `mode` ni `validated`. La default Prisma est `validated: false`. Or les requêtes du scan (`lib/cron/daily-sync-job.ts:89` et `app/api/email/analyze/route.ts:58`) filtrent `where: { ..., validated: true }`. Conséquence : tout type custom créé via la page `/missing-action` est silencieusement exclu du scan automatique. Régression directe vs v0.5.0 où ces types étaient pris en compte.
- Test gap : `tests/api/actions-manual-custom.test.ts` ne contient aucune assertion sur `validated`.
- Fix : ajouter explicitement `mode: "KEYWORDS"` (ou laisser le défaut) **et** `validated: true` dans le `data` du `tx.customActionType.create` ligne 196. Idéalement, factoriser la logique de création keywords (POST + manual route B) dans un helper `createKeywordsCustomType(tx, userId, …)` partagé qui pose toujours `validated: true`.

---

### HIGH

**[HIGH-1] Cache pollué par les body vides — re-fetch impossible pendant 5 minutes**
- Fichier : `app/api/email/[id]/body/route.ts:104-108, 131, 175-186`
- Description : `fetchBodyFromProviders` retourne `{ body: "", mimeType: "text/plain" }` dans 2 cas où le contenu n'est pas réellement disponible. Dans les deux cas, `setCachedBody` est appelé avec un body vide qui sera servi pendant 5 min.
- Fix : ne pas mettre en cache les bodies vides ; ou retourner 503/404 dans ces cas plutôt que de cacher du vide.

**[HIGH-2] vm.Script + vm.createContext recréés à chaque appel — perf significative au scan**
- Fichier : `lib/actions/regex-executor.ts:51-62`
- Description : `safelyExecuteRegex` instancie `new vm.Script(…)` puis `vm.createContext(…)` à chaque invocation. Pour un email avec N phrases et M types REGEX actifs, on crée N×M Scripts + N×M Contexts par email.
- Fix : cacher la `vm.Script` au niveau module (le code source ne change jamais). Réutiliser un contexte si possible.

**[HIGH-3] DOMPurify config : tableaux strippés + liens sans `rel="noopener"`**
- Fichier : `app/api/email/[id]/body/route.ts:58-83`
- Description : `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<td>` non autorisés → tableaux d'emails (factures, récap) entièrement perdus, dégrade la UX preview-live. `<a href>` autorisé mais `target` et `rel` ne le sont pas → tous les liens ouvrent dans le même onglet, sans `rel="noopener"`.
- Fix : ajouter `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<td>`, `<th>` aux `ALLOWED_TAGS` ; ajouter hook DOMPurify pour forcer `target="_blank"` + `rel="noopener noreferrer"` sur tous les `<a>`.

---

### MEDIUM

**[MEDIUM-1]** Test "cross-user" ne teste pas réellement le scénario cross-user (`tests/api/email-body.test.ts:115-128`).

**[MEDIUM-2]** Inconsistance entre `validateRegexPattern` et la route test-regex — la route ré-implémente la validation au lieu d'utiliser le helper (`app/api/custom-action-types/test-regex/route.ts:52-71`).

**[MEDIUM-3]** Body JSON parse error → 500 au lieu de 400/422 (`app/api/custom-action-types/route.ts:116`, `[id]/route.ts:79`).

**[MEDIUM-4]** « LRU » cache email body est en réalité du FIFO (`lib/email-body-cache.ts:77-80`).

**[MEDIUM-5]** Cache email body : pas de borne globale sur le nombre d'utilisateurs (`lib/email-body-cache.ts:25`).

**[MEDIUM-6]** `ALLOWED_URI_REGEXP` non commenté — risque de régression XSS si un dev "simplifie" sans comprendre que c'est le default DOMPurify (`app/api/email/[id]/body/route.ts:81`).

---

### LOW

**[LOW-1]** `extractCustomActionForRegexType` peut spammer les warnings sur 1 ReDoS (`lib/actions/extract-actions-regex.ts:1023-1028`).

**[LOW-2]** Test `should_return_408_when_execution_times_out` accepte 408 OU 422 — affaiblit la garantie AC-8 (`tests/api/test-regex.test.ts:159-163`).

**[LOW-3]** Tests `should_return_404_when_email_id_unknown` et `should_return_404_when_email_belongs_to_another_user` testent la même chose (`tests/api/email-body.test.ts:101-128`).

**[LOW-4]** Templates regex métier : `[A-Z]{2,10}-\d+` matchera n'importe quel "FAC-2024", "INC-1234" → risque de doublons d'actions (`lib/regex-templates.ts:48-49, 76-77`).

**[LOW-5]** `looksLikeHtml` heuristique peut faux-négatif sur emails commençant par `<!DOCTYPE` (`app/api/email/[id]/body/route.ts:45-47`).

---

### INFO

**[INFO-1]** Documentation `safelyExecuteRegex` mentionne uniquement 200ms (`regex-executor.ts:14`) alors que les callers passent 100ms (test-regex) ou 200ms (extracteur).

**[INFO-2]** Cache header `must-revalidate` superflu sans `ETag`/`Last-Modified`.

**[INFO-3]** `__resetCacheForTests` exposé en prod — pas un risque sécu mais ajouter un garde-fou `NODE_ENV !== "test"` serait propre.

**[INFO-4]** Tests qui acceptent flou sur le format de réponse (ex `keywords` null OR []) — signal de spec floue.

---

## Points positifs (à conserver)

1. Defense-in-depth anti-ReDoS bien appliqué (safe-regex à création + vm timeout au runtime, conforme ADR-005).
2. Discriminated union Zod + pré-check `detectIncoherentBody` — combinaison élégante.
3. Refactor Phase 6 (errors.ts) — `handleCreateCustomTypeError` + `regexValidationErrorResponse` factorisent proprement les helpers d'erreurs.
4. Sandbox vm avec passage de variables via `createContext` (et non interpolation string) — élimine tout risque d'injection.
5. Ownership 404 (anti-enumeration) — `findUnique({ where: { id, userId } })` retourne null si cross-user.
6. Snapshot pattern préservé — `customTypeId / Label / Color` figés sur Action.
7. Migration rétro-compatible — `UPDATE ... SET validated = true WHERE mode = 'KEYWORDS'`.
8. Filtre `validated: true` dans daily-sync ET analyze — défense en profondeur.
9. Extracteur split en helpers `extractCustomActionForRegexType` / `extractCustomActionForKeywordsType` — Strategy pattern propre.
10. Tests sandbox réalistes (pattern catastrophique réel + texte qui force timeout).
11. Validation des templates au build (`tests/lib/regex-templates.test.ts`).

---

## Validation Gate

```
[Phase 8 — REVIEW] Validation Gate
├── Lint     → pnpm lint        → PASS (1 warning préexistant, hors scope regex-power)
├── Build    → npx tsc --noEmit → PASS (aucune erreur TS)
└── Tests    → pnpm test        → PASS (312/312)
```

---

## Verdict final : **APPROVE-WITH-CHANGES**

Le code mérite d'être mergé après correction du **CRITICAL-1** (validated:true manquant dans manual route — bug de régression silencieuse) et idéalement des 3 issues HIGH. Les MEDIUM/LOW peuvent être traités en follow-up tickets.
