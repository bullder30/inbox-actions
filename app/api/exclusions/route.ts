import { NextRequest, NextResponse } from "next/server";

import { revalidateTag } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { dashboardTag } from "@/lib/cache/dashboard";

export const dynamic = "force-dynamic";

/**
 * GET /api/exclusions
 * Retourne les exclusions de l'utilisateur connecté
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const exclusions = await prisma.userExclusion.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ exclusions });
  } catch (error) {
    console.error("[Exclusions] GET error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/exclusions
 * Crée une nouvelle exclusion
 * Body: { type: "SENDER" | "DOMAIN" | "SUBJECT", value: string, label?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await req.json();
    const { type, value, label } = body;

    if (!type || !["SENDER", "DOMAIN", "SUBJECT"].includes(type)) {
      return NextResponse.json({ error: "Type invalide" }, { status: 400 });
    }
    if (!value || typeof value !== "string" || !value.trim()) {
      return NextResponse.json({ error: "Valeur manquante" }, { status: 400 });
    }

    const normalizedValue = value.trim().toLowerCase();

    const exclusion = await prisma.userExclusion.create({
      data: {
        userId: session.user.id,
        type,
        value: normalizedValue,
        label: label?.trim() || null,
      },
    });

    // Supprimer les actions existantes correspondant à l'exclusion.
    // emailFrom peut être stocké comme "email@domain.com" ou "Name <email@domain.com>".
    // On utilise un OR pour couvrir les deux formats sans faux positifs.
    let deletedCount = 0;
    if (type === "SENDER") {
      const result = await prisma.action.deleteMany({
        where: {
          userId: session.user.id,
          OR: [
            { emailFrom: { equals: normalizedValue, mode: "insensitive" } },
            { emailFrom: { contains: `<${normalizedValue}>`, mode: "insensitive" } },
          ],
        },
      });
      deletedCount = result.count;
    } else if (type === "DOMAIN") {
      const result = await prisma.action.deleteMany({
        where: {
          userId: session.user.id,
          OR: [
            { emailFrom: { endsWith: `@${normalizedValue}`, mode: "insensitive" } },
            { emailFrom: { contains: `@${normalizedValue}>`, mode: "insensitive" } },
          ],
        },
      });
      deletedCount = result.count;
    }
    // SUBJECT : le sujet n'est pas stocké sur Action, aucune suppression possible

    revalidateTag(dashboardTag(session.user.id));

    return NextResponse.json({ exclusion, deletedActions: deletedCount }, { status: 201 });
  } catch (error: unknown) {
    // Contrainte unique violée (exclusion déjà existante)
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return NextResponse.json({ error: "Cette exclusion existe déjà" }, { status: 409 });
    }
    console.error("[Exclusions] POST error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
