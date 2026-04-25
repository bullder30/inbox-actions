import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { dashboardTag } from "@/lib/cache/dashboard";
import { nameToSlug } from "@/lib/slug";
import { CUSTOM_ACTION_COLORS, rotateColor } from "@/lib/custom-action-colors";
import {
  MAX_KEYWORDS,
  MAX_REGEX_PATTERN_LENGTH,
  MAX_TYPES_PER_USER,
  MAX_TYPE_NAME_LENGTH,
  normalizeKeywords,
  validateKeywords,
  validateRegexPattern,
} from "@/lib/custom-action-types/validation";
import {
  duplicateTypeNameResponse,
  isPrismaUniqueConstraintError,
} from "@/lib/custom-action-types/errors";

export const dynamic = "force-dynamic";

const keywordsSchema = z
  .object({
    name: z.string().trim().min(1).max(MAX_TYPE_NAME_LENGTH),
    mode: z.literal("KEYWORDS"),
    keywords: z.array(z.string().trim()).min(1).max(MAX_KEYWORDS),
    color: z.enum(CUSTOM_ACTION_COLORS).optional(),
  })
  .strict();

const regexSchema = z
  .object({
    name: z.string().trim().min(1).max(MAX_TYPE_NAME_LENGTH),
    mode: z.literal("REGEX"),
    regexPattern: z.string().min(1).max(MAX_REGEX_PATTERN_LENGTH),
    color: z.enum(CUSTOM_ACTION_COLORS).optional(),
  })
  .strict();

// Schéma legacy : pas de `mode` → KEYWORDS implicite (backward compat v0.5.0)
const legacyKeywordsSchema = z
  .object({
    name: z.string().trim().min(1).max(MAX_TYPE_NAME_LENGTH),
    keywords: z.array(z.string().trim()).min(1).max(MAX_KEYWORDS),
    color: z.enum(CUSTOM_ACTION_COLORS).optional(),
  })
  .strict();

const createSchema = z.union([keywordsSchema, regexSchema, legacyKeywordsSchema]);

/**
 * Détecte un mix incohérent mode/keywords/regexPattern AVANT le parse Zod
 * pour fournir un message d'erreur ciblé (spec US-2.6).
 */
function detectIncoherentBody(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;

  if (b.mode === "REGEX") {
    if (Array.isArray(b.keywords) && b.keywords.length > 0) {
      return "keywords interdit en mode REGEX";
    }
    if (b.regexPattern === undefined || b.regexPattern === null || b.regexPattern === "") {
      return "regexPattern requis en mode REGEX";
    }
  }

  if (b.mode === "KEYWORDS") {
    if (b.regexPattern !== undefined && b.regexPattern !== null) {
      return "regexPattern interdit en mode KEYWORDS";
    }
  }

  return null;
}

/**
 * GET /api/custom-action-types
 * Liste les types custom de l'utilisateur courant.
 */
export async function GET(_req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const types = await prisma.customActionType.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ types });
  } catch (error) {
    console.error("[CustomActionTypes] GET error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/custom-action-types
 * Crée un nouveau type custom (KEYWORDS ou REGEX).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await req.json();

    // Pré-check incohérences mode/keywords/regexPattern (messages explicites)
    const incoherentMessage = detectIncoherentBody(body);
    if (incoherentMessage) {
      return NextResponse.json(
        { error: incoherentMessage },
        { status: 422 }
      );
    }

    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }

    // Branche REGEX
    if ("mode" in parsed.data && parsed.data.mode === "REGEX") {
      return await createRegexType(session.user.id, parsed.data);
    }

    // Branche KEYWORDS (mode explicite ou legacy sans mode)
    return await createKeywordsType(session.user.id, parsed.data);
  } catch (error) {
    console.error("[CustomActionTypes] POST error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

async function createKeywordsType(
  userId: string,
  data: { name: string; keywords: string[]; color?: string }
): Promise<NextResponse> {
  const { name, keywords: rawKeywords, color } = data;

  const invalidKeywords = validateKeywords(rawKeywords);
  if (invalidKeywords) {
    return NextResponse.json(
      { error: "Mots-clés invalides", invalidKeywords },
      { status: 422 }
    );
  }

  const slug = nameToSlug(name);
  const finalKeywords = normalizeKeywords(rawKeywords);

  try {
    const type = await prisma.$transaction(async (tx) => {
      const existingCount = await tx.customActionType.count({
        where: { userId },
      });
      if (existingCount >= MAX_TYPES_PER_USER) {
        throw new Error("LIMIT_REACHED");
      }
      const finalColor = color ?? rotateColor(existingCount);
      return tx.customActionType.create({
        data: {
          userId,
          name,
          slug,
          mode: "KEYWORDS",
          keywords: finalKeywords,
          regexPattern: null,
          validated: true,
          color: finalColor,
        },
      });
    });

    revalidateTag(dashboardTag(userId));
    return NextResponse.json({ type }, { status: 201 });
  } catch (createErr: unknown) {
    if (createErr instanceof Error && createErr.message === "LIMIT_REACHED") {
      return NextResponse.json(
        { error: `Vous avez atteint la limite de ${MAX_TYPES_PER_USER} types personnalisés` },
        { status: 400 }
      );
    }
    if (isPrismaUniqueConstraintError(createErr)) {
      return duplicateTypeNameResponse();
    }
    throw createErr;
  }
}

async function createRegexType(
  userId: string,
  data: { name: string; regexPattern: string; color?: string }
): Promise<NextResponse> {
  const { name, regexPattern, color } = data;

  const validation = validateRegexPattern(regexPattern);
  if (!validation.ok) {
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

  const slug = nameToSlug(name);

  try {
    const type = await prisma.$transaction(async (tx) => {
      const existingCount = await tx.customActionType.count({
        where: { userId },
      });
      if (existingCount >= MAX_TYPES_PER_USER) {
        throw new Error("LIMIT_REACHED");
      }
      const finalColor = color ?? rotateColor(existingCount);
      return tx.customActionType.create({
        data: {
          userId,
          name,
          slug,
          mode: "REGEX",
          keywords: [],
          regexPattern,
          validated: true,
          color: finalColor,
        },
      });
    });

    revalidateTag(dashboardTag(userId));
    return NextResponse.json({ type }, { status: 201 });
  } catch (createErr: unknown) {
    if (createErr instanceof Error && createErr.message === "LIMIT_REACHED") {
      return NextResponse.json(
        { error: `Vous avez atteint la limite de ${MAX_TYPES_PER_USER} types personnalisés` },
        { status: 400 }
      );
    }
    if (isPrismaUniqueConstraintError(createErr)) {
      return duplicateTypeNameResponse();
    }
    throw createErr;
  }
}
