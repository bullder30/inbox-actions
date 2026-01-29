/**
 * GET /api/imap/status
 * Récupère le statut de la connexion IMAP
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Récupérer les credentials IMAP
    const credential = await prisma.iMAPCredential.findFirst({
      where: { userId: session.user.id },
      select: {
        id: true,
        imapHost: true,
        imapPort: true,
        imapUsername: true,
        imapFolder: true,
        useTLS: true,
        isConnected: true,
        lastIMAPSync: true,
        connectionError: true,
        lastErrorAt: true,
        createdAt: true,
      },
    });

    if (!credential) {
      return NextResponse.json({
        configured: false,
        message: "No IMAP credentials configured",
      });
    }

    // Compter les emails synchronisés
    const emailCount = await prisma.emailMetadata.count({
      where: {
        userId: session.user.id,
        emailProvider: "IMAP",
      },
    });

    // Compter les emails en attente d'analyse
    const pendingCount = await prisma.emailMetadata.count({
      where: {
        userId: session.user.id,
        emailProvider: "IMAP",
        status: "EXTRACTED",
      },
    });

    return NextResponse.json({
      configured: true,
      host: credential.imapHost,
      port: credential.imapPort,
      username: credential.imapUsername,
      folder: credential.imapFolder,
      useTLS: credential.useTLS,
      isConnected: credential.isConnected,
      lastSync: credential.lastIMAPSync,
      lastError: credential.connectionError,
      lastErrorAt: credential.lastErrorAt,
      createdAt: credential.createdAt,
    });
  } catch (error) {
    console.error("[IMAP Status] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to get status",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
