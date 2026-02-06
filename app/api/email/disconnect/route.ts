import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/email/disconnect
 * Déconnecte l'email (Microsoft Graph ou IMAP) et supprime toutes les données associées (RGPD compliant)
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

      // 3. Reset email provider
      await prisma.user.update({
        where: { id: session.user.id },
        data: { emailProvider: null },
      });

      return NextResponse.json({
        success: true,
        provider: "IMAP",
        message: "IMAP déconnecté avec succès",
        deletedEmails,
      });
    }

    if (user.emailProvider === "MICROSOFT_GRAPH") {
      // Déconnexion Microsoft Graph
      const microsoftAccount = await prisma.account.findFirst({
        where: {
          userId: session.user.id,
          provider: "microsoft-entra-id",
        },
      });

      if (!microsoftAccount) {
        return NextResponse.json(
          { error: "Aucun compte Microsoft connecté" },
          { status: 400 }
        );
      }

      // 1. Supprimer toutes les métadonnées d'emails (RGPD: droit à l'effacement)
      const deletedEmailsResult = await prisma.emailMetadata.deleteMany({
        where: { userId: session.user.id },
      });
      deletedEmails = deletedEmailsResult.count;

      // 2. Supprimer le compte Microsoft de la base de données
      // Note: We don't delete the account itself as it's used for authentication
      // Just reset the email provider

      // 3. Réinitialiser les champs de sync
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          emailProvider: null,
          lastEmailSync: null,
          microsoftDeltaLink: null,
        },
      });

      return NextResponse.json({
        success: true,
        provider: "MICROSOFT_GRAPH",
        message: "Microsoft Graph déconnecté avec succès",
        deletedEmails,
      });
    }

    // No provider configured
    return NextResponse.json(
      { error: "Aucun fournisseur email configuré" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error disconnecting email:", error);
    return NextResponse.json(
      { error: "Erreur lors de la déconnexion" },
      { status: 500 }
    );
  }
}
