/**
 * Helpers d'erreurs pour les routes Custom Action Types.
 */

import { NextResponse } from "next/server";

import {
  MAX_TYPES_PER_USER,
  type RegexValidationResult,
} from "./validation";

/**
 * Sentinel error thrown inside Prisma transactions when MAX_TYPES_PER_USER is reached.
 * Caught by `handleCreateCustomTypeError` and mapped to a 400 response.
 */
export const LIMIT_REACHED_ERROR = "LIMIT_REACHED";

/**
 * Détecte si une erreur Prisma correspond à une violation de contrainte unique (P2002).
 */
export function isPrismaUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as { code: string }).code === "P2002"
  );
}

/**
 * Réponse standard 409 utilisée par les 3 endroits où l'on (re)crée un type custom :
 *   - POST /api/custom-action-types
 *   - PATCH /api/custom-action-types/[id]
 *   - POST /api/actions/manual (cas B persistAsRule)
 */
export function duplicateTypeNameResponse(): NextResponse {
  return NextResponse.json(
    { error: "Un type avec un nom équivalent existe déjà" },
    { status: 409 }
  );
}

/**
 * Mappe une erreur de transaction de création de type custom vers la `NextResponse`
 * appropriée (LIMIT_REACHED → 400, P2002 unique → 409). Si l'erreur ne matche
 * aucun cas connu, retourne `null` — le caller doit alors la relancer.
 *
 * Utilisé par les 3 endroits qui créent un CustomActionType :
 *   - POST /api/custom-action-types (KEYWORDS et REGEX)
 *   - POST /api/actions/manual (cas B persistAsRule)
 */
export function handleCreateCustomTypeError(error: unknown): NextResponse | null {
  if (error instanceof Error && error.message === LIMIT_REACHED_ERROR) {
    return NextResponse.json(
      { error: `Vous avez atteint la limite de ${MAX_TYPES_PER_USER} types personnalisés` },
      { status: 400 }
    );
  }
  if (isPrismaUniqueConstraintError(error)) {
    return duplicateTypeNameResponse();
  }
  return null;
}

/**
 * Mappe un `RegexValidationResult` invalide vers la `NextResponse` 422 attendue.
 * Préserve les variantes : `syntax_invalid` retourne `details`, les autres reasons non.
 *
 * Utilisé par POST et PATCH /api/custom-action-types.
 */
export function regexValidationErrorResponse(
  validation: Extract<RegexValidationResult, { ok: false }>
): NextResponse {
  if (validation.reason === "syntax_invalid") {
    return NextResponse.json(
      { error: "Pattern syntax invalide", reason: validation.reason, details: validation.details },
      { status: 422 }
    );
  }
  if (validation.reason === "polynomial_backtracking") {
    return NextResponse.json(
      { error: "Pattern dangereux", reason: validation.reason },
      { status: 422 }
    );
  }
  return NextResponse.json(
    { error: "Pattern invalide", reason: validation.reason },
    { status: 422 }
  );
}
