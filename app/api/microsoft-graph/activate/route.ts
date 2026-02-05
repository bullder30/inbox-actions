/**
 * POST /api/microsoft-graph/activate
 * Activates Microsoft Graph as the email provider for the user
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasMicrosoftGraphAccess } from "@/lib/microsoft-graph/graph-oauth-helper";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user has Graph API access
    const hasAccess = await hasMicrosoftGraphAccess(session.user.id);
    if (!hasAccess) {
      return NextResponse.json(
        {
          error: "Microsoft Graph API access not available",
          message: "Please re-connect your Microsoft account to grant Mail.Read permission",
        },
        { status: 400 }
      );
    }

    // Update user's email provider
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        emailProvider: "MICROSOFT_GRAPH",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Microsoft Graph API is now your active email provider",
    });
  } catch (error) {
    console.error("[Graph Activate] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to activate Microsoft Graph",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
