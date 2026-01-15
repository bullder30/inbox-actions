import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/gmail/status
 * Vérifie si l'utilisateur a connecté Gmail et le statut de la synchronisation
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

    // Vérifier si l'utilisateur a un compte Google connecté
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

    // Récupérer les informations de synchronisation
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        lastGmailSync: true,
        gmailHistoryId: true,
      },
    });

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
      hasGmailScope,
      tokenExpired: isExpired,
      lastSync: user?.lastGmailSync,
      emailCount,
      extractedCount,
      analyzedCount,
      needsReconnection: isExpired || !hasGmailScope,
    });
  } catch (error) {
    console.error("Error checking Gmail status:", error);
    return NextResponse.json(
      { error: "Erreur lors de la vérification du statut Gmail" },
      { status: 500 }
    );
  }
}
