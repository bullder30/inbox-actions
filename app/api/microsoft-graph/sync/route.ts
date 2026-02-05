/**
 * POST /api/microsoft-graph/sync
 * Synchronizes new emails via Microsoft Graph API
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { z } from "zod";

import { auth } from "@/auth";
import { createMicrosoftGraphService } from "@/lib/microsoft-graph/graph-service";

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

    // Create Graph service
    const graphService = await createMicrosoftGraphService(session.user.id);

    if (!graphService) {
      return NextResponse.json(
        { error: "Microsoft Graph API not configured or not accessible" },
        { status: 404 }
      );
    }

    // Synchronize emails
    const emails = await graphService.fetchNewEmails({
      maxResults: options.maxResults,
      folder: options.folder,
    });

    return NextResponse.json({
      success: true,
      count: emails.length,
      message: `Synchronized ${emails.length} new email(s) from Microsoft Graph`,
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
