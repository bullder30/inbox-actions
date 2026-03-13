/**
 * POST /api/microsoft-graph/sync
 * Synchronizes new emails via Microsoft Graph API
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { createMicrosoftGraphServiceByMailbox } from "@/lib/microsoft-graph/graph-service";

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

    // Parse options
    let options: { maxResults: number; folder?: string } = { maxResults: 100 };
    try {
      const body = await req.json();
      const validationResult = syncSchema.safeParse(body);
      if (validationResult.success) {
        options = validationResult.data;
      }
    } catch {
      // Empty body, use defaults
    }

    // Sync all active Graph mailboxes for this user
    const graphMailboxes = await prisma.microsoftGraphMailbox.findMany({
      where: { userId: session.user.id, isActive: true },
      select: { id: true },
    });

    if (graphMailboxes.length === 0) {
      return NextResponse.json(
        { error: "No Microsoft Graph mailbox configured" },
        { status: 404 }
      );
    }

    let totalEmails = 0;
    for (const mailbox of graphMailboxes) {
      const graphService = await createMicrosoftGraphServiceByMailbox(mailbox.id, session.user.id);
      if (!graphService) continue;
      const emails = await graphService.fetchNewEmails({
        maxResults: options.maxResults,
        folder: options.folder,
      });
      totalEmails += emails.length;
    }

    return NextResponse.json({
      success: true,
      count: totalEmails,
      message: `Synchronized ${totalEmails} new email(s) from Microsoft Graph`,
    });
  } catch (error) {
    console.error("[Graph Sync] Error:", error);
    return NextResponse.json(
      {
        error: "Sync failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
