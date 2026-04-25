# ADR-007 : Exécution regex serveur-side (cohérence + sécurité)

## Status
Accepted

## Context

La décision **D3** demande la visualisation des matches en temps réel — l'utilisateur tape un pattern, voit instantanément quelles phrases matchent. Deux options techniques :

### Option A — Exécution client-side
`new RegExp(pattern, "gi").exec(text)` directement dans le navigateur.
- ✅ **Latence zéro** (pas d'API call)
- ❌ **Cohérence** : V8 navigateur ≠ V8 Node sur certains points :
  - `sticky` flag, `lookbehind`, Unicode property escapes (`\p{L}`)
  - Différences subtiles selon version du navigateur (Safari traîne)
- ❌ **Sécurité** : pas de timeout — un ReDoS freeze l'onglet utilisateur (moins grave qu'un crash serveur, mais désagréable UX)
- ❌ **Anti-ReDoS** : `safe-regex` côté client = +50KB au bundle (pas justifié)

### Option B — Exécution serveur-side via `POST /api/custom-action-types/test-regex`
- ✅ **Cohérence garantie** : même moteur V8 Node que la prod (extracteur cron + analyze)
- ✅ **Sécurité** : timeout vm + safe-regex appliqués (couche 2 ADR-005)
- ✅ **Pas de bundle client alourdi** : `safe-regex` reste serveur
- ⚠️ **Latence** ~50-150ms par test (vs 0ms client)

## Decision

**Toute exécution regex passe par le serveur** via `POST /api/custom-action-types/test-regex`.

### Endpoint
```
POST /api/custom-action-types/test-regex
Body: { pattern: string, testText: string[] }
```
- `pattern` : 1-200 chars
- `testText` : array 1-10 strings, chaque max 5 KB

### Pipeline serveur
1. Auth → 401
2. `safe-regex(pattern)` → 422 si dangereux
3. Pour chaque `testText[i]` :
   - `safelyExecuteRegex(pattern, text, 100)` (timeout 100ms — plus court qu'extracteur car interactif)
   - Collecte `[start, end]` de chaque match
4. Si timeout sur l'un → 408 avec details
5. Réponse 200 avec `matches: Array<{ textIndex, ranges: [[start, end]] }>`

### UX côté client
- **Debounce 300ms** sur le typing utilisateur (pattern field, test textarea)
- **Skeleton loader** pendant la requête
- **Cache mémoire UI** (objet) keyed par `pattern + textHash` pour éviter de re-fetch les combinaisons déjà testées dans la session
- Composant `<MatchHighlighter text={...} ranges={...} />` rend le texte avec `<mark>` aux positions
- Si erreur 408/422 : afficher l'erreur en zone test (« Pattern trop complexe » / « Pattern dangereux »)

## Consequences

### Positive
- ✅ **Cohérence garantie** : ce qui matche au test matche en prod (même V8, mêmes flags)
- ✅ **Sécurité** : pas d'exposition du moteur regex côté client, anti-ReDoS centralisé
- ✅ **Bundle client léger** : `safe-regex` (~50KB) reste serveur uniquement
- ✅ **Source de vérité unique** : un seul endroit où la sécurité regex est implémentée

### Negative
- ⚠️ **Latence** ~50-150ms par test (vs 0ms client). Mitigé par debounce 300ms (souvent l'utilisateur typing colle la latence sous le seuil de perception)
- ⚠️ **Surcoût d'API call** à chaque modification du pattern. Mitigé par debounce + cache UI

### Risks
- 🚨 Si le serveur est lent (cold start Vercel), la 1ère requête peut prendre 1-2s. Mitigation : skeleton + UX message « Vérification en cours… ». Acceptable car rare (warm-up unique).
- 🚨 Limite : si l'utilisateur teste sur de gros textes (proche 5 KB × 10), le timeout 100ms peut être atteint pour des patterns légitimes mais lents. Mitigation : message clair + suggestion de réduire la taille des testText.
