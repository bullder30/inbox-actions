/**
 * GET /api/imap/test
 * Teste la connexion IMAP existante et retourne la liste des dossiers
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { createIMAPService } from "@/lib/imap/imap-service";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Créer le service IMAP
    const imapService = await createIMAPService(session.user.id);

    if (!imapService) {
      return NextResponse.json(
        { error: "No IMAP credentials configured" },
        { status: 404 }
      );
    }

    // Tester la connexion
    const isConnected = await imapService.testConnection();

    if (!isConnected) {
      return NextResponse.json(
        { error: "IMAP connection test failed" },
        { status: 400 }
      );
    }

    // Récupérer la liste des dossiers
    const folders = await imapService.getFolders();

    return NextResponse.json({
      success: true,
      message: "IMAP connection is working",
      folders: folders.map((f) => ({
        name: f.name,
        path: f.path,
      })),
    });
  } catch (error) {
    console.error("[IMAP Test] Error:", error);
    return NextResponse.json(
      {
        error: "Connection test failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
