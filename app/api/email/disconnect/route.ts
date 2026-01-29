import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { google } from "googleapis";

export const dynamic = "force-dynamic";

/**
 * POST /api/email/disconnect
 * Déconnecte l'email (Gmail ou IMAP) et supprime toutes les données associées (RGPD compliant)
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

    // Récupérer les informations utilisateur
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { emailProvider: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Utilisateur non trouvé" },
        { status: 404 }
      );
    }

    let deletedEmails = 0;

    if (user.emailProvider === "IMAP") {
      // Déconnexion IMAP
      const imapCredential = await prisma.iMAPCredential.findFirst({
        where: { userId: session.user.id },
      });

      if (!imapCredential) {
        return NextResponse.json(
          { error: "Aucun compte IMAP connecté" },
          { status: 400 }
        );
      }

      // 1. Supprimer toutes les métadonnées d'emails (RGPD: droit à l'effacement)
      const deletedEmailsResult = await prisma.emailMetadata.deleteMany({
        where: { userId: session.user.id },
      });
      deletedEmails = deletedEmailsResult.count;

      // 2. Supprimer les credentials IMAP
      await prisma.iMAPCredential.delete({
        where: { id: imapCredential.id },
      });

      // 3. Remettre le provider par défaut (Gmail)
      await prisma.user.update({
        where: { id: session.user.id },
        data: { emailProvider: "GMAIL" },
      });

      return NextResponse.json({
        success: true,
        provider: "IMAP",
        message: "IMAP déconnecté avec succès",
        deletedEmails,
      });
    }

    // Par défaut: Gmail
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
    const deletedEmailsResult = await prisma.emailMetadata.deleteMany({
      where: { userId: session.user.id },
    });
    deletedEmails = deletedEmailsResult.count;

    // 3. Supprimer le compte Google de la base de données
    await prisma.account.delete({
      where: { id: googleAccount.id },
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
      provider: "GMAIL",
      message: "Gmail déconnecté avec succès",
      deletedEmails,
    });
  } catch (error) {
    console.error("Error disconnecting email:", error);
    return NextResponse.json(
      { error: "Erreur lors de la déconnexion" },
      { status: 500 }
    );
  }
}
