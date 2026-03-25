/**
 * POST /api/imap/disconnect
 * Déconnecte et supprime une credential IMAP spécifique
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const credentialId = body.credentialId as string | undefined;

    if (!credentialId) {
      return NextResponse.json(
        { error: "credentialId is required" },
        { status: 400 }
      );
    }

    // Supprimer uniquement la credential spécifiée, en vérifiant que l'utilisateur en est propriétaire
    const deleted = await prisma.iMAPCredential.deleteMany({
      where: {
        id: credentialId,
        userId: session.user.id,
      },
    });

    if (deleted.count === 0) {
      return NextResponse.json(
        { error: "Credential not found" },
        { status: 404 }
      );
    }

    revalidatePath("/dashboard");

    return NextResponse.json({
      success: true,
      message: "IMAP credential disconnected successfully",
    });
  } catch (error) {
    console.error("[IMAP Disconnect] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to disconnect",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
