import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/gmail/status
 * Vérifie si l'utilisateur a connecté un email (Gmail ou IMAP) et le statut de la synchronisation
 */
export async function GET() {
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
      select: {
        emailProvider: true,
        lastGmailSync: true,
        gmailHistoryId: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Utilisateur non trouvé" },
        { status: 404 }
      );
    }

    // Vérifier selon le provider configuré
    if (user.emailProvider === "IMAP") {
      // Vérifier les credentials IMAP
      const imapCredential = await prisma.iMAPCredential.findFirst({
        where: { userId: session.user.id },
        select: {
          isConnected: true,
          connectionError: true,
          lastIMAPSync: true,
          lastErrorAt: true,
        },
      });

      if (!imapCredential) {
        return NextResponse.json({
          connected: false,
          provider: "IMAP",
          message: "IMAP n'est pas configuré",
        });
      }

      // Compter les emails en base
      const emailCount = await prisma.emailMetadata.count({
        where: { userId: session.user.id },
      });

      // Compter les emails extraits non encore analysés
      const extractedCount = await prisma.emailMetadata.count({
        where: {
          userId: session.user.id,
          status: "EXTRACTED",
        },
      });

      // Compter les emails analysés
      const analyzedCount = await prisma.emailMetadata.count({
        where: {
          userId: session.user.id,
          status: "ANALYZED",
        },
      });

      return NextResponse.json({
        connected: imapCredential.isConnected,
        provider: "IMAP",
        hasScope: true, // IMAP n'a pas de scopes
        tokenExpired: false, // IMAP utilise des mots de passe, pas de tokens
        lastSync: imapCredential.lastIMAPSync,
        emailCount,
        extractedCount,
        analyzedCount,
        needsReconnection: !imapCredential.isConnected,
        connectionError: imapCredential.connectionError,
      });
    }

    // Par défaut: Gmail
    const googleAccount = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        provider: "google",
      },
      select: {
        access_token: true,
        expires_at: true,
        scope: true,
      },
    });

    if (!googleAccount) {
      return NextResponse.json({
        connected: false,
        provider: "GMAIL",
        message: "Gmail n'est pas connecté",
      });
    }

    // Vérifier si le token est expiré
    const now = Math.floor(Date.now() / 1000);
    const isExpired = googleAccount.expires_at
      ? googleAccount.expires_at < now
      : false;

    // Vérifier si le scope Gmail est présent
    const hasGmailScope = googleAccount.scope?.includes("gmail.readonly") || false;

    // Compter les emails en base
    const emailCount = await prisma.emailMetadata.count({
      where: { userId: session.user.id },
    });

    // Compter les emails extraits non encore analysés
    const extractedCount = await prisma.emailMetadata.count({
      where: {
        userId: session.user.id,
        status: "EXTRACTED",
      },
    });

    // Compter les emails analysés
    const analyzedCount = await prisma.emailMetadata.count({
      where: {
        userId: session.user.id,
        status: "ANALYZED",
      },
    });

    return NextResponse.json({
      connected: true,
      provider: "GMAIL",
      hasGmailScope,
      tokenExpired: isExpired,
      lastSync: user.lastGmailSync,
      emailCount,
      extractedCount,
      analyzedCount,
      needsReconnection: isExpired || !hasGmailScope,
    });
  } catch (error) {
    console.error("Error checking email status:", error);
    return NextResponse.json(
      { error: "Erreur lors de la vérification du statut email" },
      { status: 500 }
    );
  }
}
