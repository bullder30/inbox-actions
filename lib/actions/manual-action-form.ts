/**
 * Helpers purs pour le formulaire de création d'action manuelle
 * depuis la page /missing-action.
 *
 * Logique extraite pour testabilité (tests RED en Phase 4) :
 * - Le composant React orchestre l'état + les fetches
 * - Ces helpers calculent : keywords candidates depuis la phrase source,
 *   construction du body API selon le cas (natif / custom existant /
 *   nouveau ponctuel / nouveau règle).
 *
 * Voir docs/features/custom-actions.md (US-6, US-7) pour la spec.
 */

import type { CustomActionColor } from "@/lib/custom-action-colors";
import { FRENCH_STOPLIST } from "@/lib/stoplist-fr";

/** Sentinelle utilisée comme valeur du Select pour "Créer un nouveau type". */
export const NEW_CUSTOM_SENTINEL = "__new_custom__";

const NATIVE_TYPES = ["SEND", "CALL", "FOLLOW_UP", "PAY", "VALIDATE"] as const;
type NativeType = typeof NATIVE_TYPES[number];

const MIN_CANDIDATE_KEYWORD_LENGTH = 4;
const MAX_CANDIDATE_KEYWORDS = 5;

export interface ManualActionFormState {
  title: string;
  sentence: string;
  /** Soit une `NativeType`, soit l'`id` d'un custom existant, soit `NEW_CUSTOM_SENTINEL`. */
  typeSelection: string;
  newCustomName: string;
  newCustomColor: CustomActionColor;
  newKeywords: string[];
  persistAsRule: boolean;
}

export interface ManualActionEmail {
  from: string;
  receivedAt: string | Date;
  gmailMessageId?: string | null;
  imapUID?: string | null;
  webUrl?: string | null;
}

export interface ManualActionCustomType {
  id: string;
  name: string;
  color: CustomActionColor;
}

/**
 * Extrait jusqu'à `max` mots-clés candidats depuis une phrase source.
 * Filtre la stoplist FR et les mots < 4 caractères. Dédup case-insensitive.
 */
export function extractCandidateKeywords(sentence: string, max = MAX_CANDIDATE_KEYWORDS): string[] {
  if (!sentence) return [];
  const words = sentence
    .toLowerCase()
    .replace(/[^a-z0-9àâäéèêëïîôöùûüÿñç\s-]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= MIN_CANDIDATE_KEYWORD_LENGTH && !FRENCH_STOPLIST.has(w));
  return Array.from(new Set(words)).slice(0, max);
}

function isNativeType(value: string): value is NativeType {
  return (NATIVE_TYPES as readonly string[]).includes(value);
}

/**
 * Construit le body POST `/api/actions/manual` selon le mode du formulaire.
 *
 * Cas :
 *  - typeSelection ∈ NATIVE_TYPES → action native (5 défauts)
 *  - typeSelection = id d'un custom existant → action CUSTOM avec customTypeId (cas A)
 *  - typeSelection = NEW_CUSTOM_SENTINEL :
 *    - persistAsRule: true → cas B (nouvelle règle + action, transaction Prisma)
 *    - persistAsRule: false → cas C (ponctuel, customTypeId null + snapshots gelés)
 */
export function buildManualActionBody(
  state: ManualActionFormState,
  email: ManualActionEmail,
  customTypes: ManualActionCustomType[]
): Record<string, unknown> {
  const baseBody = {
    title: state.title.trim(),
    sourceSentence: state.sentence.trim(),
    emailFrom: email.from,
    emailReceivedAt: email.receivedAt,
    gmailMessageId: email.gmailMessageId ?? null,
    imapUID: email.imapUID ?? null,
    emailWebUrl: email.webUrl ?? null,
  };

  if (state.typeSelection === NEW_CUSTOM_SENTINEL) {
    const newCustom: Record<string, unknown> = {
      ...baseBody,
      type: "CUSTOM",
      customTypeName: state.newCustomName.trim(),
      customTypeColor: state.newCustomColor,
      persistAsRule: state.persistAsRule,
    };
    if (state.persistAsRule) {
      newCustom.keywords = state.newKeywords;
    }
    return newCustom;
  }

  const existing = customTypes.find((t) => t.id === state.typeSelection);
  if (existing) {
    return {
      ...baseBody,
      type: "CUSTOM",
      customTypeId: existing.id,
    };
  }

  if (isNativeType(state.typeSelection)) {
    return {
      ...baseBody,
      type: state.typeSelection,
    };
  }

  // Fallback défensif : si typeSelection est inconnu, on bascule sur SEND (natif).
  return {
    ...baseBody,
    type: "SEND",
  };
}

/** Re-export pour les composants UI qui ont besoin de la liste pour le Select. */
export const NATIVE_TYPE_OPTIONS: { value: NativeType; label: string }[] = [
  { value: "SEND", label: "Envoyer" },
  { value: "CALL", label: "Appeler" },
  { value: "FOLLOW_UP", label: "Relancer" },
  { value: "PAY", label: "Payer" },
  { value: "VALIDATE", label: "Valider" },
];
