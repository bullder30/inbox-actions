import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { dashboardTag } from "@/lib/cache/dashboard";
import { nameToSlug } from "@/lib/slug";
import { FRENCH_STOPLIST } from "@/lib/stoplist-fr";
import { CUSTOM_ACTION_COLORS } from "@/lib/custom-action-colors";

export const dynamic = "force-dynamic";

const MIN_KEYWORD_LENGTH = 4;
const MAX_KEYWORD_LENGTH = 60;
const MAX_KEYWORDS = 50;

const patchSchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  keywords: z.array(z.string().trim()).min(1).max(MAX_KEYWORDS).optional(),
  color: z.enum(CUSTOM_ACTION_COLORS).optional(),
  isActive: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

function validateKeywords(rawKeywords: string[]): string[] | null {
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

function normalizeKeywords(rawKeywords: string[]): string[] {
  return Array.from(
    new Set(rawKeywords.map((k) => k.trim()).filter((k) => k.length > 0))
  );
}

/**
 * PATCH /api/custom-action-types/[id]
 * Modifie un type custom existant. Aucune Action historique n'est rétro-modifiée.
 */
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { id } = await ctx.params;

    const existing = await prisma.customActionType.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Type introuvable" }, { status: 404 });
    }
    if (existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) {
      updateData.name = parsed.data.name;
      updateData.slug = nameToSlug(parsed.data.name);
    }
    if (parsed.data.keywords !== undefined) {
      const invalid = validateKeywords(parsed.data.keywords);
      if (invalid) {
        return NextResponse.json(
          { error: "Mots-clés invalides", invalidKeywords: invalid },
          { status: 422 }
        );
      }
      updateData.keywords = normalizeKeywords(parsed.data.keywords);
    }
    if (parsed.data.color !== undefined) {
      updateData.color = parsed.data.color;
    }
    if (parsed.data.isActive !== undefined) {
      updateData.isActive = parsed.data.isActive;
    }

    try {
      const type = await prisma.customActionType.update({
        where: { id },
        data: updateData,
      });
      revalidateTag(dashboardTag(session.user.id));
      return NextResponse.json({ type });
    } catch (updateErr: unknown) {
      if (
        updateErr instanceof Error &&
        "code" in updateErr &&
        (updateErr as { code: string }).code === "P2002"
      ) {
        return NextResponse.json(
          { error: "Un type avec un nom équivalent existe déjà" },
          { status: 409 }
        );
      }
      throw updateErr;
    }
  } catch (error) {
    console.error("[CustomActionTypes] PATCH error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * DELETE /api/custom-action-types/[id]
 * Supprime un type custom. Les Actions liées gardent leur snapshot label/color.
 */
export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { id } = await ctx.params;

    const existing = await prisma.customActionType.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Type introuvable" }, { status: 404 });
    }
    if (existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const affectedActions = await prisma.action.count({
      where: {
        customTypeId: id,
        status: { in: ["TODO"] },
      },
    });

    await prisma.customActionType.delete({ where: { id } });
    revalidateTag(dashboardTag(session.user.id));

    const message =
      affectedActions > 0
        ? `${affectedActions} action(s) active(s) gardent ce label figé`
        : undefined;

    return NextResponse.json({ success: true, affectedActions, message });
  } catch (error) {
    console.error("[CustomActionTypes] DELETE error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
