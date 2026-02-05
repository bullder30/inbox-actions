/**
 * GET /api/microsoft-graph/status
 * Retrieves Microsoft Graph API connection status
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { env } from "@/env.mjs";
import { prisma } from "@/lib/db";
import { getMicrosoftGraphStatus } from "@/lib/microsoft-graph/graph-oauth-helper";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if Microsoft OAuth is configured
    const microsoftOAuthEnabled = !!(
      env.MICROSOFT_CLIENT_ID &&
      env.MICROSOFT_CLIENT_SECRET &&
      env.MICROSOFT_TENANT_ID
    );

    if (!microsoftOAuthEnabled) {
      return NextResponse.json({
        configured: false,
        hasMailReadScope: false,
        hasAccount: false,
        microsoftOAuthEnabled: false,
        message: "Microsoft OAuth is not configured on this server",
      });
    }

    // Check Microsoft Graph access
    const graphStatus = await getMicrosoftGraphStatus(session.user.id);

    if (!graphStatus.hasAccount) {
      return NextResponse.json({
        configured: false,
        hasMailReadScope: false,
        hasAccount: false,
        microsoftOAuthEnabled: true,
        message: "No Microsoft account linked",
      });
    }

    if (!graphStatus.hasMailReadScope) {
      return NextResponse.json({
        configured: false,
        hasMailReadScope: false,
        hasAccount: true,
        microsoftOAuthEnabled: true,
        message: "Microsoft account linked but Mail.Read scope not granted. Please re-connect to grant permission.",
      });
    }

    // Get user sync status
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        emailProvider: true,
        lastEmailSync: true,
        microsoftDeltaLink: true,
      },
    });

    // Count synced emails
    const emailCount = await prisma.emailMetadata.count({
      where: {
        userId: session.user.id,
        emailProvider: "MICROSOFT_GRAPH",
      },
    });

    // Count pending analysis
    const pendingCount = await prisma.emailMetadata.count({
      where: {
        userId: session.user.id,
        emailProvider: "MICROSOFT_GRAPH",
        status: "EXTRACTED",
      },
    });

    return NextResponse.json({
      configured: true,
      hasMailReadScope: true,
      hasAccount: true,
      microsoftOAuthEnabled: true,
      isConnected: graphStatus.isTokenValid,
      isActiveProvider: user?.emailProvider === "MICROSOFT_GRAPH",
      email: graphStatus.email,
      lastSync: user?.lastEmailSync,
      hasDeltaLink: !!user?.microsoftDeltaLink,
      stats: {
        totalEmails: emailCount,
        pendingAnalysis: pendingCount,
      },
    });
  } catch (error) {
    console.error("[Graph Status] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to get status",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
