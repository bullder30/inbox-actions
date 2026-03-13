import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/email/status
 * Retourne le statut global des boîtes mail connectées (IMAP + Microsoft Graph)
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Récupérer les credentials IMAP
    const imapCredentials = await prisma.iMAPCredential.findMany({
      where: { userId },
      select: {
        id: true,
        isConnected: true,
        lastIMAPSync: true,
      },
    });

    // Récupérer les boîtes Microsoft Graph actives
    const graphMailboxes = await prisma.microsoftGraphMailbox.findMany({
      where: { userId, isActive: true },
      select: { id: true, lastSync: true, isConnected: true },
    });

    const imapConnected = imapCredentials.some((c) => c.isConnected);
    const graphConnected = graphMailboxes.length > 0;
    const connected = imapConnected || graphConnected;

    // Dernière sync globale (la plus récente parmi tous les providers)
    const lastSyncCandidates: Date[] = [];
    for (const c of imapCredentials) {
      if (c.lastIMAPSync) lastSyncCandidates.push(c.lastIMAPSync);
    }
    for (const m of graphMailboxes) {
      if (m.lastSync) lastSyncCandidates.push(m.lastSync);
    }
    const lastSync = lastSyncCandidates.length
      ? new Date(Math.max(...lastSyncCandidates.map((d) => d.getTime())))
      : null;

    // Compter les emails en base
    const emailCount = await prisma.emailMetadata.count({ where: { userId } });
    const extractedCount = await prisma.emailMetadata.count({
      where: { userId, status: "EXTRACTED" },
    });
    const analyzedCount = await prisma.emailMetadata.count({
      where: { userId, status: "ANALYZED" },
    });

    const graphTokenExpired = graphMailboxes.some((m) => !m.isConnected);

    return NextResponse.json({
      connected,
      imapConnected,
      graphConnected,
      lastSync,
      emailCount,
      extractedCount,
      analyzedCount,
      needsReconnection: graphConnected && graphTokenExpired,
    });
  } catch (error) {
    console.error("Error checking email status:", error);
    return NextResponse.json(
      { error: "Erreur lors de la vérification du statut email" },
      { status: 500 }
    );
  }
}
