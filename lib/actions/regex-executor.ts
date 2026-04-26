/**
 * Anti-ReDoS executor (ADR-005, US-3, US-5).
 *
 * Stratégie en 2 couches :
 *   1. `isPatternSafe()` — gate à la création (heuristique safe-regex)
 *   2. `safelyExecuteRegex()` — sandbox runtime via vm + timeout
 *
 * Couvre AC-1 (rejet création) et AC-6 (skip runtime sur timeout).
 */

import vm from "vm";
import safeRegex from "safe-regex";

const DEFAULT_TIMEOUT_MS = 200;

// Hoisted hors de safelyExecuteRegex pour éviter de recompiler la Script vm
// à chaque appel (gain ~10-20× sur scan de masse). Le code source ne change
// jamais ; seules les variables `__pattern__` / `__text__` du contexte varient.
const COMPILED_SCRIPT = new vm.Script(`
  const re = new RegExp(__pattern__, "gi");
  const matches = [];
  let m;
  while ((m = re.exec(__text__)) !== null) {
    matches.push({ index: m.index, length: m[0].length });
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  matches;
`);

/**
 * Wrapper safe-regex : retourne `true` si le pattern est jugé sans risque
 * de backtracking polynomial. Heuristique (peut avoir des faux négatifs,
 * mitigés par la couche 2 vm timeout).
 */
export function isPatternSafe(pattern: string): boolean {
  return safeRegex(pattern);
}

export interface RegexMatch {
  index: number;
  length: number;
}

export interface ExecuteResult {
  matches: RegexMatch[];
  timedOut: boolean;
}

/**
 * Exécute une regex utilisateur dans un sandbox vm avec timeout.
 *
 * @param pattern Pattern brut (les flags sont forcés à `gi`).
 * @param text Texte à scanner.
 * @param timeoutMs Limite d'exécution (défaut 200ms).
 * @returns `matches` (vide si rien trouvé OU si timeout) + `timedOut` flag.
 *
 * Si timeout : caller doit logger un warning + skip cet email pour ce type.
 * Si pattern invalide : throw (caller doit catch ou pré-valider).
 */
export function safelyExecuteRegex(
  pattern: string,
  text: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): ExecuteResult {
  const ctx = vm.createContext({ __pattern__: pattern, __text__: text });

  try {
    const matches = COMPILED_SCRIPT.runInContext(ctx, { timeout: timeoutMs }) as RegexMatch[];
    return { matches, timedOut: false };
  } catch (err) {
    if (isTimeoutError(err)) {
      return { matches: [], timedOut: true };
    }
    throw err;
  }
}

/**
 * Détecte les erreurs de timeout vm — supporte plusieurs runtimes (Node 18/20/22 + workers vitest).
 */
function isTimeoutError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;

  const code = (err as { code?: string }).code;
  if (code === "ERR_SCRIPT_EXECUTION_TIMEOUT") return true;

  const message = (err as { message?: string }).message;
  if (typeof message === "string" && message.includes("Script execution timed out")) {
    return true;
  }

  return false;
}
