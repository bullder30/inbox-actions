/**
 * POST /api/microsoft-graph/disconnect
 * Disconnects Microsoft Graph email access (removes Mail.Read scope)
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find Microsoft account
    const microsoftAccount = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        provider: "microsoft-entra-id",
      },
    });

    if (!microsoftAccount) {
      return NextResponse.json(
        { error: "No Microsoft account found" },
        { status: 404 }
      );
    }

    // Remove Mail.Read scope (keeps account for login but disables email access)
    const newScope = (microsoftAccount.scope || "")
      .replace("https://graph.microsoft.com/Mail.Read", "")
      .replace(/\s+/g, " ")
      .trim();

    await prisma.account.update({
      where: { id: microsoftAccount.id },
      data: { scope: newScope },
    });

    // Clear Microsoft sync data and reset provider if it was Microsoft Graph
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { emailProvider: true },
    });

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        lastEmailSync: null,
        microsoftDeltaLink: null,
        // Reset email provider if it was Microsoft Graph
        ...(user?.emailProvider === "MICROSOFT_GRAPH" && { emailProvider: null }),
      },
    });

    console.log(`[Graph Disconnect] Microsoft Graph disconnected for user ${session.user.id}`);

    return NextResponse.json({
      success: true,
      message: "Microsoft Graph disconnected",
    });
  } catch (error) {
    console.error("[Graph Disconnect] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to disconnect",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
