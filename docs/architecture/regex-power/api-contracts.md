# API Contracts — Regex Power

2 nouveaux endpoints + extension des routes existantes [custom-actions](../api-contracts.md).

---

## `POST /api/custom-action-types/test-regex` (NEW)

Endpoint de la zone de test pour validation visuelle (Settings + missing-action).

**Auth** : session NextAuth → 401 sinon

**Body**
```json
{
  "pattern": "FAC-\\d{4}-\\d+",
  "testText": [
    "Voir FAC-2024-0042 jointe",
    "rien à voir ici",
    "FAC-2025-1 et FAC-2025-2 sont en attente"
  ]
}
```

**Validation Zod** (`.strict()`) :
- `pattern` : string, 1-200 chars
- `testText` : array, min 1, max 10
- Chaque `testText[i]` : string, max 5 KB (~5000 chars)

**Pipeline serveur**
1. Auth check
2. `isPatternSafe(pattern)` (`safe-regex`) → si false : `422 { error: "Pattern dangereux", reason: "polynomial_backtracking" }`
3. Pour chaque `testText[i]` : `safelyExecuteRegex(pattern, text, 100)` (timeout 100ms)
4. Si timedOut sur au moins un : `408 { error: "Pattern trop complexe (timeout 100ms)", textIndex: i }`
5. Sinon : collecter les ranges de chaque match

**Response 200**
```json
{
  "matches": [
    { "textIndex": 0, "ranges": [[5, 16]] },
    { "textIndex": 1, "ranges": [] },
    { "textIndex": 2, "ranges": [[0, 11], [13, 24]] }
  ]
}
```

**Errors**
- `401` Unauthorized — pas de session
- `408` Request Timeout — pattern trop complexe (avec `textIndex` qui timeout)
- `422` Unprocessable Entity — pattern invalide ou unsafe-regex
- `500` Internal Error

---

## `GET /api/email/[id]/body` (NEW)

Endpoint de récupération du corps d'un email pour visualisation live missing-action.

**Auth** : session NextAuth → 401 sinon

**Params**
- `id` : string (id de l'`EmailMetadata` ou `Action`)

**Pipeline serveur**
1. Auth check
2. `prisma.emailMetadata.findUnique({ where: { id, userId: session.user.id } })` → `404` si introuvable ou ownership KO
3. **Cache check** (Map RAM per-user, TTL 5 min) → si hit, return direct
4. **Sinon** : récupérer le body via le provider (`lib/email-provider/factory.ts`)
   - IMAP : `imapProvider.getEmailBodyForAnalysis(imapUID)`
   - Graph : `graphProvider.getEmailBodyForAnalysis(messageId)`
5. Tronquer à **50 KB max**, set `truncated: true` si dépassement
6. Si HTML : sanitize via `isomorphic-dompurify` avec config restrictive (whitelist tags + attributes)
7. Stocker dans cache (TTL 5min, LRU max 100 entrées)
8. Headers : `Cache-Control: private, max-age=300, must-revalidate`

**Response 200**
```json
{
  "body": "Bonjour David, peux-tu vérifier la facture FAC-2024-0042 avant vendredi ?",
  "truncated": false,
  "mimeType": "text/plain"
}
```

**Errors**
- `401` Unauthorized
- `404` Not Found — id inconnu OU ownership KO (rationale : éviter enumeration attack)
- `503` Service Unavailable — token IMAP/Graph expiré → message « Reconnectez votre boîte mail dans Settings »
- `500` Internal Error

---

## `POST /api/custom-action-types` — extension

Extension du body existant pour supporter `mode: "REGEX"`.

### Body — cas KEYWORDS (existant, inchangé)
```json
{
  "name": "Review code",
  "mode": "KEYWORDS",
  "keywords": ["review", "PR", "merge request"],
  "color": "violet"
}
```

### Body — cas REGEX (NEW)
```json
{
  "name": "Facture client",
  "mode": "REGEX",
  "regexPattern": "FAC-\\d{4}-\\d+",
  "color": "amber"
}
```

**Validation Zod (`.strict()`) — discrimination sur `mode`**
- `mode` : enum `"KEYWORDS" | "REGEX"`, défaut `"KEYWORDS"`
- Si `mode === "KEYWORDS"` : `keywords` requis (1-50 entrées 4-60 chars), `regexPattern` interdit
- Si `mode === "REGEX"` : `regexPattern` requis (1-200 chars), `keywords` interdit

**Pipeline (mode=REGEX)**
1. Auth + count limite + slug uniqueness (mêmes règles existantes)
2. **Run `safe-regex(regexPattern)`** → si false : `422 { error: "Pattern dangereux", reason: "polynomial_backtracking" }`
3. Si OK → `prisma.create({ data: { ..., mode: "REGEX", regexPattern, validated: true } })`
4. Cache invalidation (revalidateTag)

**Response 201** (cas REGEX)
```json
{
  "type": {
    "id": "...",
    "name": "Facture client",
    "mode": "REGEX",
    "regexPattern": "FAC-\\d{4}-\\d+",
    "validated": true,
    "color": "amber",
    "isActive": true,
    "createdAt": "..."
  }
}
```

---

## `PATCH /api/custom-action-types/[id]` — extension

Mêmes règles d'invariants que POST. Si `mode` ou `regexPattern` change :
1. Re-validation `safe-regex(regexPattern)` → 422 si dangereux
2. Update `validated` selon résultat (toujours `true` si on a passé le check)
3. Si `mode` change de REGEX → KEYWORDS : `regexPattern` doit être null après update + `keywords` doit être fourni

---

## Codes HTTP — récap regex-power

| Code | Sens | Cas |
|---|---|---|
| 200 | OK | GET body, PATCH custom-action-type |
| 201 | Created | POST custom-action-type (mode KEYWORDS ou REGEX) |
| 400 | Bad Request | Limite 10 atteinte, body malformé |
| 401 | Unauthorized | Pas de session |
| 403 | Forbidden | Tentative custom-action-types/[id] cross-user |
| 404 | Not Found | id inconnu (custom-action-type ou email) |
| 408 | Request Timeout | `vm.runInNewContext` timeout (test-regex) |
| 409 | Conflict | Slug unique violé |
| 422 | Unprocessable Entity | Pattern dangereux (safe-regex), mode/keywords/regexPattern incohérent |
| 503 | Service Unavailable | IMAP/Graph token expiré (email body) |
| 500 | Internal Error | Erreur serveur |
