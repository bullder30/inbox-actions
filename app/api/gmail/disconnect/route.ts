import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { google } from "googleapis";

export const dynamic = "force-dynamic";

/**
 * POST /api/gmail/disconnect
 * Déconnecte Gmail et supprime toutes les données associées (RGPD compliant)
 */
export async function POST() {
  try {
    // Vérification de l'authentification
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    // Récupérer le compte Google
    const googleAccount = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        provider: "google",
      },
    });

    if (!googleAccount) {
      return NextResponse.json(
        { error: "Aucun compte Gmail connecté" },
        { status: 400 }
      );
    }

    // 1. Révoquer le token Google (optionnel mais recommandé RGPD)
    if (googleAccount.access_token) {
      try {
        const oauth2Client = new google.auth.OAuth2();
        oauth2Client.setCredentials({
          access_token: googleAccount.access_token,
        });
        await oauth2Client.revokeCredentials();
      } catch (error) {
        // Ignorer les erreurs de révocation (le token peut déjà être invalide)
        console.warn("Could not revoke token:", error);
      }
    }

    // 2. Supprimer toutes les métadonnées d'emails (RGPD: droit à l'effacement)
    const deletedEmails = await prisma.emailMetadata.deleteMany({
      where: {
        userId: session.user.id,
      },
    });

    // 3. Supprimer le compte Google de la base de données
    await prisma.account.delete({
      where: {
        id: googleAccount.id,
      },
    });

    // 4. Réinitialiser les champs de sync Gmail
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        lastGmailSync: null,
        gmailHistoryId: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Gmail déconnecté avec succès",
      deletedEmails: deletedEmails.count,
    });
  } catch (error) {
    console.error("Error disconnecting Gmail:", error);
    return NextResponse.json(
      { error: "Erreur lors de la déconnexion de Gmail" },
      { status: 500 }
    );
  }
}
