/**
 * Validation et normalisation partagées des types custom (limites + keywords).
 *
 * Centralise les règles dupliquées entre :
 *   - app/api/custom-action-types/route.ts (POST)
 *   - app/api/custom-action-types/[id]/route.ts (PATCH)
 *   - app/api/actions/manual/route.ts (cas B persistAsRule)
 */

import { FRENCH_STOPLIST } from "@/lib/stoplist-fr";

export const MAX_TYPES_PER_USER = 10;
export const MAX_TYPE_NAME_LENGTH = 50;
export const MIN_KEYWORD_LENGTH = 4;
export const MAX_KEYWORD_LENGTH = 60;
export const MAX_KEYWORDS = 50;

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
