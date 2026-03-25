/**
 * POST /api/microsoft-graph/disconnect
 * Deletes a specific MicrosoftGraphMailbox for the current user.
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { mailboxId } = body as { mailboxId?: string };

    if (!mailboxId) {
      return NextResponse.json({ error: "mailboxId is required" }, { status: 400 });
    }

    // Delete the mailbox (verify ownership)
    const deleted = await prisma.microsoftGraphMailbox.deleteMany({
      where: {
        id: mailboxId,
        userId: session.user.id,
      },
    });

    if (deleted.count === 0) {
      return NextResponse.json({ error: "Mailbox not found" }, { status: 404 });
    }

    console.log(`[Graph Disconnect] Deleted mailbox ${mailboxId} for user ${session.user.id}`);

    revalidatePath("/dashboard");

    return NextResponse.json({ success: true, message: "Microsoft mailbox disconnected" });
  } catch (error) {
    console.error("[Graph Disconnect] Error:", error);
    return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 });
  }
}
