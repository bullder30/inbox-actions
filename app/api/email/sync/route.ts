import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { auth } from "@/auth";
import { dashboardTag } from "@/lib/cache/dashboard";
import { createAllEmailProviders } from "@/lib/email-provider/factory";
import { MAX_EMAILS_TO_SYNC } from "@/lib/config/sync";
import type { EmailMetadata } from "@/lib/email-provider/interface";

export const dynamic = "force-dynamic";

/**
 * GET /api/email/sync
 * Synchronise les emails depuis toutes les boîtes configurées
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const providers = await createAllEmailProviders(session.user.id);

    if (providers.length === 0) {
      return NextResponse.json(
        {
          error: "Email non connecté ou le token a expiré",
          message: "Veuillez vous (re)connecter pour activer la synchronisation",
          code: "EMAIL_NOT_CONNECTED",
        },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(req.url);
    const maxResultsParam = searchParams.get("maxResults");
    const maxResults = maxResultsParam ? parseInt(maxResultsParam) : MAX_EMAILS_TO_SYNC;

    let totalCount = 0;
    const allEmails: EmailMetadata[] = [];

    for (const provider of providers) {
      try {
        const emails = await provider.fetchNewEmails({ maxResults, folder: "INBOX" });
        totalCount += emails.length;
        allEmails.push(...emails);
      } catch (err) {
        console.error(`[SYNC] Error syncing mailbox ${provider.mailboxId}:`, err);
      } finally {
        try { await provider.disconnect(); } catch {}
      }
    }

    revalidateTag(dashboardTag(session.user.id));

    return NextResponse.json({
      success: true,
      count: totalCount,
      emails: allEmails.map((email) => ({
        id: email.gmailMessageId || email.imapUID?.toString(),
        from: email.from,
        subject: email.subject,
        snippet: email.snippet,
        receivedAt: email.receivedAt,
        labels: email.labels,
      })),
      message: `${totalCount} nouveau(x) email(s) synchronisé(s)`,
    });
  } catch (error) {
    console.error("Error syncing emails:", error);
    if (error instanceof Error && error.message.includes("expired")) {
      return NextResponse.json(
        { error: "Token expiré", message: "Veuillez vous reconnecter", code: "TOKEN_EXPIRED" },
        { status: 401 }
      );
    }
    return NextResponse.json({ error: "Erreur lors de la synchronisation des emails" }, { status: 500 });
  }
}
