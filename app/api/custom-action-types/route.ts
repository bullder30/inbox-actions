import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { dashboardTag } from "@/lib/cache/dashboard";
import { nameToSlug } from "@/lib/slug";
import { FRENCH_STOPLIST } from "@/lib/stoplist-fr";
import { CUSTOM_ACTION_COLORS, rotateColor } from "@/lib/custom-action-colors";

export const dynamic = "force-dynamic";

const MAX_TYPES_PER_USER = 10;
const MIN_KEYWORD_LENGTH = 4;
const MAX_KEYWORD_LENGTH = 60;
const MAX_KEYWORDS = 50;

const createSchema = z.object({
  name: z.string().trim().min(1).max(50),
  keywords: z.array(z.string().trim()).min(1).max(MAX_KEYWORDS),
  color: z.enum(CUSTOM_ACTION_COLORS).optional(),
});

type InvalidKeywordsError = { invalid: string[] };

/**
 * Valide une liste de keywords brut.
 *
 * Règles :
 * - length > 60 → invalide (anti-ReDoS)
 * - length < 4 ET keyword est all-lowercase → invalide (mots trop courts non-acronymes)
 * - lowercase form ∈ stoplist FR → invalide
 *
 * Les acronymes courts en majuscules (ex. "PR") sont tolérés.
 */
function validateKeywords(rawKeywords: string[]): InvalidKeywordsError | null {
  const invalid: string[] = [];
  const trimmed = rawKeywords.map((k) => k.trim()).filter((k) => k.length > 0);
  const deduped = Array.from(new Set(trimmed));

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

  return invalid.length > 0 ? { invalid } : null;
}

/**
 * Normalise les keywords pour stockage : trim + dédup, conserve la casse originale.
 */
function normalizeKeywords(rawKeywords: string[]): string[] {
  const trimmed = rawKeywords.map((k) => k.trim()).filter((k) => k.length > 0);
  return Array.from(new Set(trimmed));
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
 * Crée un nouveau type custom.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }
    const { name, keywords: rawKeywords, color } = parsed.data;

    // Filtrer les keywords (chars + stoplist)
    const keywordValidation = validateKeywords(rawKeywords);
    if (keywordValidation) {
      return NextResponse.json(
        { error: "Mots-clés invalides", invalidKeywords: keywordValidation.invalid },
        { status: 422 }
      );
    }

    // Vérifier la limite
    const existingCount = await prisma.customActionType.count({
      where: { userId: session.user.id },
    });
    if (existingCount >= MAX_TYPES_PER_USER) {
      return NextResponse.json(
        { error: `Vous avez atteint la limite de ${MAX_TYPES_PER_USER} types personnalisés` },
        { status: 400 }
      );
    }

    const slug = nameToSlug(name);
    const finalColor = color ?? rotateColor(existingCount);
    const finalKeywords = normalizeKeywords(rawKeywords);

    try {
      const type = await prisma.customActionType.create({
        data: {
          userId: session.user.id,
          name,
          slug,
          keywords: finalKeywords,
          color: finalColor,
        },
      });

      revalidateTag(dashboardTag(session.user.id));
      return NextResponse.json({ type }, { status: 201 });
    } catch (createErr: unknown) {
      if (
        createErr instanceof Error &&
        "code" in createErr &&
        (createErr as { code: string }).code === "P2002"
      ) {
        return NextResponse.json(
          { error: "Un type avec un nom équivalent existe déjà" },
          { status: 409 }
        );
      }
      throw createErr;
    }
  } catch (error) {
    console.error("[CustomActionTypes] POST error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
