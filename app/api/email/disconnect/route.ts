import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/email/disconnect
 * Déconnecte TOUS les emails (Microsoft Graph + IMAP) et supprime toutes les données associées (RGPD compliant)
 * @deprecated Prefer /api/imap/disconnect and /api/microsoft-graph/disconnect for per-mailbox control
 */
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Supprimer toutes les métadonnées d'emails (RGPD: droit à l'effacement)
    const deletedEmailsResult = await prisma.emailMetadata.deleteMany({
      where: { userId },
    });

    // Supprimer tous les credentials IMAP
    await prisma.iMAPCredential.deleteMany({ where: { userId } });

    // Désactiver toutes les boîtes Microsoft Graph
    await prisma.microsoftGraphMailbox.updateMany({
      where: { userId },
      data: { isActive: false, deltaLink: null },
    });

    return NextResponse.json({
      success: true,
      message: "Toutes les boîtes mail déconnectées",
      deletedEmails: deletedEmailsResult.count,
    });
  } catch (error) {
    console.error("Error disconnecting email:", error);
    return NextResponse.json(
      { error: "Erreur lors de la déconnexion" },
      { status: 500 }
    );
  }
}
