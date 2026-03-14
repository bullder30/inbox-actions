/**
 * GET /api/imap/status
 * Récupère la liste de toutes les boîtes IMAP configurées
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

    const credentials = await prisma.iMAPCredential.findMany({
      where: { userId: session.user.id },
      select: {
        id: true,
        label: true,
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
      orderBy: { createdAt: "asc" },
    });

    // Retourner configured=false si aucune credential
    if (credentials.length === 0) {
      return NextResponse.json({
        configured: false,
        mailboxes: [],
        message: "No IMAP credentials configured",
      });
    }

    const mailboxes = credentials.map((c) => ({
      id: c.id,
      label: c.label,
      host: c.imapHost,
      port: c.imapPort,
      username: c.imapUsername,
      folder: c.imapFolder,
      useTLS: c.useTLS,
      isConnected: c.isConnected,
      lastSync: c.lastIMAPSync,
      lastError: c.connectionError,
      lastErrorAt: c.lastErrorAt,
      createdAt: c.createdAt,
    }));

    return NextResponse.json({
      configured: true,
      mailboxes,
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
