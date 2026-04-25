/**
 * Validation et normalisation partagées des types custom (limites + keywords).
 *
 * Centralise les règles dupliquées entre :
 *   - app/api/custom-action-types/route.ts (POST)
 *   - app/api/custom-action-types/[id]/route.ts (PATCH)
 *   - app/api/actions/manual/route.ts (cas B persistAsRule)
 */

import safeRegex from "safe-regex";

import { FRENCH_STOPLIST } from "@/lib/stoplist-fr";

export const MAX_TYPES_PER_USER = 10;
export const MAX_TYPE_NAME_LENGTH = 50;
export const MIN_KEYWORD_LENGTH = 4;
export const MAX_KEYWORD_LENGTH = 60;
export const MAX_KEYWORDS = 50;
export const MAX_REGEX_PATTERN_LENGTH = 200;

/**
 * Raisons de rejet d'un pattern regex (utilisé dans les réponses API 422).
 */
export type RegexValidationReason =
  | "too_long"
  | "syntax_invalid"
  | "polynomial_backtracking";

export interface RegexValidationResult {
  ok: boolean;
  reason?: RegexValidationReason;
  details?: string;
}

/**
 * Valide un pattern regex utilisateur en 3 passes :
 *   1. longueur ≤ MAX_REGEX_PATTERN_LENGTH
 *   2. syntaxe (RegExp constructor ne throw pas avec flag "gi")
 *   3. heuristique anti-ReDoS (safe-regex)
 *
 * @returns `{ ok: true }` si OK, sinon `{ ok: false, reason, details? }`
 */
export function validateRegexPattern(
  pattern: string
): RegexValidationResult {
  if (pattern.length > MAX_REGEX_PATTERN_LENGTH) {
    return { ok: false, reason: "too_long" };
  }

  try {
    new RegExp(pattern, "gi");
  } catch (err) {
    return {
      ok: false,
      reason: "syntax_invalid",
      details: err instanceof Error ? err.message : "Invalid regex syntax",
    };
  }

  // Appel direct à safe-regex (pas via wrapper) pour rester indépendant
  // des mocks de tests sur `@/lib/actions/regex-executor`.
  if (!safeRegex(pattern)) {
    return { ok: false, reason: "polynomial_backtracking" };
  }

  return { ok: true };
}

/**
 * Valide une liste de keywords brut.
 *
 * Règles :
 * - length > MAX_KEYWORD_LENGTH → invalide (anti-ReDoS)
 * - length < MIN_KEYWORD_LENGTH ET keyword est all-lowercase → invalide
 *   (mots trop courts, sauf acronymes en majuscules type "PR")
 * - lowercase form ∈ stoplist FR → invalide
 *
 * @returns Liste des keywords invalides, ou `null` si tous valides.
 */
export function validateKeywords(rawKeywords: string[]): string[] | null {
  const invalid: string[] = [];
  const deduped = Array.from(
    new Set(rawKeywords.map((k) => k.trim()).filter((k) => k.length > 0))
  );

  for (const keyword of deduped) {
    const lower = keyword.toLowerCase();
    const isAllLowercase = keyword === lower;

    if (keyword.length > MAX_KEYWORD_LENGTH) {
      invalid.push(keyword);
      continue;
    }
    if (keyword.length < MIN_KEYWORD_LENGTH && isAllLowercase) {
      invalid.push(keyword);
      continue;
    }
    if (FRENCH_STOPLIST.has(lower)) {
      invalid.push(keyword);
    }
  }

  return invalid.length > 0 ? invalid : null;
}

/**
 * Normalise les keywords pour stockage : trim + dédup, conserve la casse originale.
 */
export function normalizeKeywords(rawKeywords: string[]): string[] {
  return Array.from(
    new Set(rawKeywords.map((k) => k.trim()).filter((k) => k.length > 0))
  );
}
