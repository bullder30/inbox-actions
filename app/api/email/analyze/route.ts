import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { createAllEmailProviders } from "@/lib/email-provider/factory";
import { extractActionsFromEmail, type UserExclusionData } from "@/lib/actions/extract-actions-regex";
import { getEndOfTodayParis } from "@/lib/utils/date-paris";
import { prisma } from "@/lib/db";
import { sendActionDigest } from "@/lib/notifications/action-digest-service";
import { MAX_EMAILS_TO_ANALYZE } from "@/lib/config/sync";
import type { IEmailProvider } from "@/lib/email-provider/interface";

export const dynamic = "force-dynamic";

function getMessageId(email: { gmailMessageId?: string | null; imapUID?: bigint | null }): string | bigint {
  if (email.gmailMessageId) return email.gmailMessageId;
  if (email.imapUID) return email.imapUID;
  throw new Error("No message ID found");
}

/**
 * POST /api/email/analyze
 * Analyse les emails non traités de toutes les boîtes et extrait les actions par REGEX
 */
export async function POST(req: NextRequest) {
  const providers: IEmailProvider[] = [];

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const allProviders = await createAllEmailProviders(session.user.id);
    providers.push(...allProviders);

    if (providers.length === 0) {
      return NextResponse.json(
        { error: "Email non connecté", message: "Veuillez connecter votre email pour analyser vos messages" },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const maxEmails = body.maxEmails ?? MAX_EMAILS_TO_ANALYZE;

    // Charger les exclusions utilisateur une seule fois pour toute la session
    const userExclusions = await prisma.userExclusion.findMany({
      where: { userId: session.user.id },
      select: { type: true, value: true },
    }) as UserExclusionData[];

    let processedCount = 0;
    let extractedActionsCount = 0;
    let skippedCount = 0;

    for (const emailProvider of providers) {
      const extractedEmails = await emailProvider.getExtractedEmails();
      const emailsToProcess = extractedEmails.slice(0, maxEmails);

      console.log(`[Analyze] Mailbox ${emailProvider.mailboxId}: ${emailsToProcess.length}/${extractedEmails.length} emails à traiter`);

      for (const emailMetadata of emailsToProcess) {
        try {
          const messageId = getMessageId(emailMetadata);
          const emailBody = await emailProvider.getEmailBodyForAnalysis(messageId);

          if (!emailBody) {
            await emailProvider.markEmailAsAnalyzed(messageId);
            processedCount++;
            continue;
          }

          const extractedActions = extractActionsFromEmail({
            from: emailMetadata.from,
            subject: emailMetadata.subject,
            body: emailBody,
            receivedAt: emailMetadata.receivedAt,
          }, userExclusions);

          for (const action of extractedActions) {
            await prisma.action.create({
              data: {
                userId: session.user.id,
                title: action.title,
                type: action.type,
                sourceSentence: action.sourceSentence,
                emailFrom: emailMetadata.from,
                emailReceivedAt: emailMetadata.receivedAt,
                gmailMessageId: emailMetadata.gmailMessageId,
                imapUID: emailMetadata.imapUID,
                emailWebUrl: emailMetadata.webUrl,
                dueDate: action.dueDate,
                isScheduled: action.dueDate ? action.dueDate > getEndOfTodayParis() : false,
                mailboxId: emailProvider.mailboxId,
                mailboxLabel: emailProvider.mailboxLabel,
              },
            });
            extractedActionsCount++;
          }

          await emailProvider.markEmailAsAnalyzed(messageId);
          processedCount++;
        } catch (error) {
          const msgId = emailMetadata.gmailMessageId || emailMetadata.imapUID?.toString() || "unknown";
          console.error(`Error processing email ${msgId}:`, error);
          skippedCount++;
        }
      }
    }

    if (extractedActionsCount > 0) {
      try {
        await sendActionDigest(session.user.id);
      } catch (notifError) {
        console.error("[Analyze] Error sending notification:", notifError);
      }
    }

    return NextResponse.json({
      success: true,
      processedEmails: processedCount,
      extractedActions: extractedActionsCount,
      skippedEmails: skippedCount,
      message: `${extractedActionsCount} action(s) extraite(s) depuis ${processedCount} email(s)`,
    });
  } catch (error) {
    console.error("Error analyzing emails:", error);
    return NextResponse.json({ error: "Erreur lors de l'analyse des emails" }, { status: 500 });
  } finally {
    for (const provider of providers) {
      try { await provider.disconnect(); } catch {}
    }
  }
}
