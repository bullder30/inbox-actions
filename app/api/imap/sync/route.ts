/**
 * POST /api/imap/sync
 * Synchronise les nouveaux emails via IMAP
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { z } from "zod";

import { auth } from "@/auth";
import { createIMAPService } from "@/lib/imap/imap-service";

const syncSchema = z.object({
  maxResults: z.number().int().positive().max(500).optional().default(100),
  folder: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parser les options
    let options: { maxResults: number; folder?: string } = { maxResults: 100 };
    try {
      const body = await req.json();
      const validationResult = syncSchema.safeParse(body);
      if (validationResult.success) {
        options = validationResult.data;
      }
    } catch {
      // Body vide, utiliser les valeurs par défaut
    }

    // Créer le service IMAP
    const imapService = await createIMAPService(session.user.id);

    if (!imapService) {
      return NextResponse.json(
        { error: "No IMAP credentials configured" },
        { status: 404 }
      );
    }

    // Synchroniser les emails
    const emails = await imapService.fetchNewEmails({
      maxResults: options.maxResults,
      folder: options.folder,
    });

    return NextResponse.json({
      success: true,
      count: emails.length,
      message: `Synchronized ${emails.length} new email(s)`,
    });
  } catch (error) {
    console.error("[IMAP Sync] Error:", error);
    return NextResponse.json(
      {
        error: "Sync failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
