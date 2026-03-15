import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

/**
 * DELETE /api/exclusions/[id]
 * Supprime une exclusion appartenant à l'utilisateur connecté
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { id } = await params;

    await prisma.userExclusion.delete({
      where: {
        id,
        userId: session.user.id, // sécurité : l'exclusion doit appartenir à l'utilisateur
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code: string }).code === "P2025"
    ) {
      return NextResponse.json({ error: "Exclusion introuvable" }, { status: 404 });
    }
    console.error("[Exclusions] DELETE error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
