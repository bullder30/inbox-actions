/**
 * POST /api/imap/disconnect
 * Déconnecte et supprime les credentials IMAP
 */

import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Supprimer les credentials IMAP de l'utilisateur
    const deleted = await prisma.iMAPCredential.deleteMany({
      where: { userId: session.user.id },
    });

    if (deleted.count === 0) {
      return NextResponse.json(
        { error: "No IMAP credentials found" },
        { status: 404 }
      );
    }

    // Remettre le provider email à Gmail par défaut
    await prisma.user.update({
      where: { id: session.user.id },
      data: { emailProvider: "GMAIL" },
    });

    // Optionnel : supprimer aussi les métadonnées d'emails IMAP
    // (décommenter si vous voulez un nettoyage complet)
    // await prisma.emailMetadata.deleteMany({
    //   where: {
    //     userId: session.user.id,
    //     emailProvider: "IMAP",
    //   },
    // });

    return NextResponse.json({
      success: true,
      message: "IMAP credentials disconnected successfully",
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
