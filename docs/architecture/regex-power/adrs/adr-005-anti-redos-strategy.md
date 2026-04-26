# ADR-005 : Stratégie anti-ReDoS 2-couches

## Status
Accepted — validé en Phase 1 (Big Picture, décision D1)

## Context

Le risque R-01 du Big Picture regex-power est CRITICAL : un pattern utilisateur crafté (intentionnellement ou par maladresse) peut bloquer le scan via backtracking exponentiel — par exemple `(a+)+b` sur une chaîne de 30 'a' suivie de 'c' tourne plusieurs minutes.

Trois bibliothèques candidates :
- **`safe-regex`** : heuristique légère. Détecte les patterns à risque polynomial. Faux négatifs possibles. ~50KB.
- **`re2`** : binding C++ de Google RE2. Garantie formelle O(n) sur tout pattern. Compilation native difficile en serverless (Vercel/Lambda) car nécessite pré-compilation par région et version Node.
- **`vm.runInNewContext`** : module Node natif, permet d'exécuter du code dans un contexte isolé avec timeout en ms. Pas une garantie formelle anti-ReDoS, mais coupe net après le délai.

## Decision

**Stratégie en 2 couches complémentaires** :

### Couche 1 — Gate à la création (`safe-regex`)

À chaque `POST /api/custom-action-types` ou `PATCH` qui modifie le pattern :
1. Run `safe-regex(pattern)` (boolean check)
2. Si **rejette** → `422 { error: "Pattern potentiellement dangereux", reason: "polynomial_backtracking" }` + suggestions
3. Si **accepte** → stocke `validated: true` en base

→ Empêche **99%** des patterns dangereux de jamais entrer en base.

### Couche 2 — Sandbox runtime (`vm.runInNewContext` + timeout 200ms)

À chaque exécution dans `extractCustomActionsFromEmail` :
1. Charger le pattern depuis `customType.regexPattern` (`validated: true` garanti — la query DB filtre)
2. Construire la regex
3. Exécuter le `pattern.exec(text)` dans `vm.runInNewContext` avec timeout 200ms
4. Si **timeout** → `try/catch` capture l'exception, **log warning** + skip cet email pour ce type custom + continue le scan global

→ Filet de sécurité contre les **faux négatifs** de `safe-regex`.

### Pourquoi pas `re2` ?

- Compilation native C++ difficile sur Vercel serverless (chaque région = version Node + arch différente)
- Risques runtime imprévisibles selon le déploiement
- Gain marginal vs `vm + timeout` pour notre cas (regex courtes, < 200 chars, sur emails < 50 KB)
- Si à terme on migre hors serverless → réévaluer `re2` en V2

## Consequences

### Positive
- ✅ **Défense en profondeur** : un pattern qui passe `safe-regex` mais explose au runtime est contenu
- ✅ **Compatible serverless** : zéro dépendance native (Vercel-friendly)
- ✅ **Gracieux** : un bug pattern ne crash pas le scan global, juste son email pour ce type custom
- ✅ **Simple à débugger** : log warning explicite avec id du pattern et email

### Negative
- ⚠️ `vm.runInNewContext` overhead **~5-10ms par exécution** (acceptable : 50ms / 100 emails)
- ⚠️ `safe-regex` peut avoir des **faux négatifs** (heuristique pure). Mitigé par couche 2.
- ⚠️ Faux positifs de `safe-regex` : un pattern légitime peut être rejeté à tort. Mitigation : message d'erreur clair avec lien vers la doc + suggestion d'alternatives.

### Risks
- 🚨 Si l'utilisateur réutilise un pattern marqué `validated: true` mais qui timeout en prod → besoin de **monitoring** : un compteur `regex_timeout_count` par `customTypeId`. Si > 10 timeouts en 24h → invalider auto et alerter le user.
- 🚨 `vm.runInNewContext` **n'est PAS** un sandbox de sécurité complet (≠ `isolated-vm`). Pour notre usage (regex pure, sans `require`/`eval`), c'est acceptable. Important : ne **jamais** passer du code utilisateur arbitraire à `vm`, uniquement le pattern regex.
- 🚨 Limite à la défense : un pattern qui ne déclenche pas le timeout mais consomme beaucoup de CPU sans dépasser 200ms × emails peut quand même dégrader. Mitigation : monitoring CPU prod + alerting si scan dépasse 30s.

## Implementation hint

```ts
// lib/actions/regex-executor.ts
import vm from "vm";
import safeRegex from "safe-regex";

export function isPatternSafe(pattern: string): boolean {
  return safeRegex(pattern);
}

export interface ExecuteResult {
  matches: Array<{ index: number; length: number }>;
  timedOut: boolean;
}

export function safelyExecuteRegex(
  pattern: string,
  text: string,
  timeoutMs = 200
): ExecuteResult {
  const script = new vm.Script(`
    const re = new RegExp(__pattern__, "gi");
    const matches = [];
    let m;
    while ((m = re.exec(__text__)) !== null) {
      matches.push({ index: m.index, length: m[0].length });
      if (m.index === re.lastIndex) re.lastIndex++;
    }
    matches;
  `);
  const ctx = vm.createContext({ __pattern__: pattern, __text__: text });
  try {
    const matches = script.runInContext(ctx, { timeout: timeoutMs });
    return { matches, timedOut: false };
  } catch (err) {
    if (err instanceof Error && err.message.includes("Script execution timed out")) {
      return { matches: [], timedOut: true };
    }
    throw err;
  }
}
```
