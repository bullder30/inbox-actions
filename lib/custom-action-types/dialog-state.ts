/**
 * Helpers d'état pour le dialog création/édition d'un type custom
 * (`components/settings/custom-action-types-section.tsx`).
 *
 * Logique extraite pour testabilité (UI Step 1/3 regex-power) :
 * - Le composant React orchestre useState + appels fetch
 * - Ces helpers calculent : init/reset selon le mode, validation pré-fetch
 *   du pattern (évite round-trip 422 pour erreurs locales), construction
 *   du payload POST/PATCH selon le mode discriminé KEYWORDS / REGEX.
 *
 * Voir docs/features/regex-power.md (US-1, US-2, US-7).
 */

import {
  CUSTOM_ACTION_COLORS,
  type CustomActionColor,
  rotateColor,
} from "@/lib/custom-action-colors";
import {
  MAX_REGEX_PATTERN_LENGTH,
  validateRegexPattern,
} from "@/lib/custom-action-types/validation";

export type DialogMode = "KEYWORDS" | "REGEX";

export interface DialogState {
  mode: DialogMode;
  name: string;
  keywords: string[];
  regexPattern: string;
  color: CustomActionColor;
  isActive: boolean;
}

export interface EditingType {
  id: string;
  name: string;
  slug: string;
  keywords: string[];
  color: CustomActionColor;
  isActive: boolean;
  mode: DialogMode;
  regexPattern: string | null;
  validated: boolean;
}

/**
 * Construit l'état initial du dialog :
 *   - Création : couleur rotée selon `existingCount`, mode KEYWORDS par défaut
 *   - Édition : pré-remplit depuis `editingType` selon son mode actuel
 */
export function initialDialogState(args: {
  existingCount: number;
  editingType: EditingType | null;
}): DialogState {
  const { existingCount, editingType } = args;

  if (editingType) {
    return {
      mode: editingType.mode,
      name: editingType.name,
      keywords: editingType.keywords,
      regexPattern: editingType.regexPattern ?? "",
      color: editingType.color,
      isActive: editingType.isActive,
    };
  }

  return {
    mode: "KEYWORDS",
    name: "",
    keywords: [],
    regexPattern: "",
    color: rotateColor(existingCount) ?? CUSTOM_ACTION_COLORS[0],
    isActive: true,
  };
}

/**
 * Toggle de mode : reset les champs incompatibles (keywords ↔ regexPattern)
 * pour éviter d'envoyer un payload incohérent au serveur.
 * Les champs neutres (name, color, isActive) sont conservés.
 */
export function resetForMode(state: DialogState, nextMode: DialogMode): DialogState {
  if (state.mode === nextMode) return state;
  return {
    ...state,
    mode: nextMode,
    keywords: [],
    regexPattern: "",
  };
}

/**
 * Validation locale du pattern regex (pré-fetch).
 *
 * Évite le round-trip 422 pour les erreurs détectables côté client :
 *   - vide ou whitespace-only
 *   - trop long
 *   - syntaxe invalide
 *   - polynomial backtracking détecté par safe-regex
 */
export function isPatternFieldValid(pattern: string): boolean {
  const trimmed = pattern.trim();
  if (trimmed.length === 0) return false;
  if (trimmed.length > MAX_REGEX_PATTERN_LENGTH) return false;
  return validateRegexPattern(trimmed).ok;
}

type CreateKeywordsPayload = {
  mode: "KEYWORDS";
  name: string;
  keywords: string[];
  color: CustomActionColor;
};

type CreateRegexPayload = {
  mode: "REGEX";
  name: string;
  regexPattern: string;
  color: CustomActionColor;
};

export type CreatePayload = CreateKeywordsPayload | CreateRegexPayload;

/**
 * Construit le body POST `/api/custom-action-types` discriminé sur `mode`.
 * Trim le name, n'inclut JAMAIS keywords en mode REGEX (et inversement).
 */
export function buildCreatePayload(state: DialogState): CreatePayload {
  if (state.mode === "REGEX") {
    return {
      mode: "REGEX",
      name: state.name.trim(),
      regexPattern: state.regexPattern.trim(),
      color: state.color,
    };
  }
  return {
    mode: "KEYWORDS",
    name: state.name.trim(),
    keywords: state.keywords,
    color: state.color,
  };
}

type PatchKeywordsPayload = CreateKeywordsPayload & { isActive: boolean };
type PatchRegexPayload = CreateRegexPayload & { isActive: boolean };
export type PatchPayload = PatchKeywordsPayload | PatchRegexPayload;

/**
 * Construit le body PATCH `/api/custom-action-types/[id]` (idem POST + isActive).
 */
export function buildPatchPayload(state: DialogState): PatchPayload {
  return { ...buildCreatePayload(state), isActive: state.isActive };
}
