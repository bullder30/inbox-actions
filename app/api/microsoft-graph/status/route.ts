/**
 * GET /api/microsoft-graph/status
 * Returns the list of Microsoft Graph mailboxes for the current user,
 * plus whether Microsoft OAuth is configured server-side.
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { env } from "@/env.mjs";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const microsoftOAuthEnabled = !!(
      env.MICROSOFT_CLIENT_ID &&
      env.MICROSOFT_CLIENT_SECRET &&
      env.MICROSOFT_TENANT_ID
    );

    const mailboxes = await prisma.microsoftGraphMailbox.findMany({
      where: { userId: session.user.id, isActive: true },
      select: {
        id: true,
        label: true,
        email: true,
        isConnected: true,
        connectionError: true,
        lastSync: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      microsoftOAuthEnabled,
      mailboxes,
    });
  } catch (error) {
    console.error("[Graph Status] Error:", error);
    return NextResponse.json({ error: "Failed to get status" }, { status: 500 });
  }
}
