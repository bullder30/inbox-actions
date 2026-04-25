/**
 * Helpers d'erreurs pour les routes Custom Action Types.
 */

import { NextResponse } from "next/server";

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
