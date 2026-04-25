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
  MAX_TYPES_PER_USER,
  MAX_TYPE_NAME_LENGTH,
  normalizeKeywords,
  validateKeywords,
} from "@/lib/custom-action-types/validation";
import {
  duplicateTypeNameResponse,
  isPrismaUniqueConstraintError,
} from "@/lib/custom-action-types/errors";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().trim().min(1).max(MAX_TYPE_NAME_LENGTH),
  keywords: z.array(z.string().trim()).min(1).max(MAX_KEYWORDS),
  color: z.enum(CUSTOM_ACTION_COLORS).optional(),
});

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
    const invalidKeywords = validateKeywords(rawKeywords);
    if (invalidKeywords) {
      return NextResponse.json(
        { error: "Mots-clés invalides", invalidKeywords },
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
      if (isPrismaUniqueConstraintError(createErr)) {
        return duplicateTypeNameResponse();
      }
      throw createErr;
    }
  } catch (error) {
    console.error("[CustomActionTypes] POST error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
