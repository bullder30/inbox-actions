# ADR-006 : Endpoint `GET /api/email/[id]/body` (ownership + RGPD + cache)

## Status
Accepted

## Context

La décision **D3** du Big Picture regex-power impose la visualisation des matches en temps réel sur le **corps complet d'un email** depuis `/missing-action`. L'utilisateur écrit ou modifie son pattern → l'UI doit afficher quelles parties du mail matchent.

Or, le code existant ne stocke **aucun corps d'email** (RGPD strict — voir CLAUDE.md). Le body est récupéré temporairement via `lib/email-provider/*.getEmailBodyForAnalysis()` puis immédiatement oublié.

Pas d'endpoint exposé pour récupérer un body à la demande.

## Decision

Créer un nouvel endpoint **`GET /api/email/[id]/body`** :

### Sécurité
- **Auth** : session NextAuth obligatoire → `401` sinon
- **Ownership** : `findUnique({ where: { id, userId: session.user.id } })` → `404` si l'email n'appartient pas au user (404 plutôt que 403 pour éviter l'enumeration attack)

### Performance + RGPD
- **Tronquage à 50 KB** : suffit largement pour highlight sur emails normaux. Si > 50 KB → réponse `truncated: true` (le user verra une note dans l'UI)
- **Cache RAM 5 minutes** : `Map<string, { body, mimeType, expiresAt }>` per-user dans le module process. **Pas de persistance disque** → respect RGPD strict
- **Pas de Cache-Control disque côté client** : header `Cache-Control: private, max-age=300, must-revalidate` (le navigateur peut conserver côté mémoire pour la session de test, mais pas en disque)

### Sanitization
- Si `mimeType === "text/html"` : passer par `isomorphic-dompurify` avec config restrictive
  - Tags conservés : `p`, `br`, `div`, `span`, `a`, `ul/ol/li`, `b/strong/i/em`, `code/pre`, `blockquote`
  - Strippé : `script`, `iframe`, `object`, `embed`, `style`, attributs `on*`, `javascript:` URLs
- L'UI affiche le HTML sanitized (pas via `dangerouslySetInnerHTML` mais via parser → React tree, ou via `textContent` pour highlight pur)

### Récupération
- Réutilise `lib/email-provider/factory.ts` existant
- Si IMAP : `imapProvider.getEmailBodyForAnalysis(imapUID)`
- Si Microsoft Graph : `graphProvider.getEmailBodyForAnalysis(messageId)`
- Si token expiré → `503 Service Unavailable` avec message « Reconnectez votre boîte mail »

## Consequences

### Positive
- ✅ Permet la visualisation live missing-action (D3 livré)
- ✅ Strict RGPD : pas de persistance disque, troncature, ownership obligatoire
- ✅ Réutilise le code provider existant (pas de duplication)
- ✅ Cache 5min réduit la charge IMAP/Graph (l'UI fait beaucoup de requêtes pendant le test pattern)

### Negative
- ⚠️ **Latence variable** selon provider (IMAP > Graph en général). UX : skeleton loader pendant le 1er fetch + cache 5min compense
- ⚠️ Cache **RAM only** = perdu au redéploiement Vercel (cold start). Acceptable car TTL 5min de toute façon
- ⚠️ Limite Vercel serverless : la Map est par-instance, pas global → un cold start ailleurs = miss. OK pour un cache best-effort

### Risks
- 🚨 **Token IMAP/Graph expiré** : un user qui n'a pas synchronisé depuis longtemps verra `503`. Mitigation : message d'erreur clair + lien vers Settings pour reconnecter
- 🚨 **XSS** si la sanitization HTML est trop permissive ou bypassed. Mitigation : DOMPurify avec config restrictive + tests de sécurité dédiés (tests/api/email-body.test.ts) + audit manuel des tags autorisés
- 🚨 **Memory leak** du cache si jamais purgé. Mitigation : implémentation LRU avec maxSize 100 entrées + `setInterval` de nettoyage des expirés toutes les minutes (ou utiliser une lib comme `lru-cache`)
- 🚨 **Race condition** : 2 requêtes concurrentes pour le même email peuvent appeler le provider 2 fois. Mitigation : pattern singleton-flight (Map<id, Promise>) — pas critique au MVP
