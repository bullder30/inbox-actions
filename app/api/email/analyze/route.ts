import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { dashboardTag } from "@/lib/cache/dashboard";

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

    const userId = session.user.id as string;

    // Traiter toutes les boîtes en parallèle (connexions indépendantes)
    const providerResults = await Promise.all(
      providers.map(async (emailProvider) => {
        let processedCount = 0;
        let extractedActionsCount = 0;
        let skippedCount = 0;

        const extractedEmails = await emailProvider.getExtractedEmails();
        const emailsToProcess = extractedEmails.slice(0, maxEmails);

        console.log(`[Analyze] Mailbox ${emailProvider.mailboxId}: ${emailsToProcess.length}/${extractedEmails.length} emails à traiter`);

        // Emails traités séquentiellement pour éviter le rate-limiting IMAP/Graph
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

            if (extractedActions.length > 0) {
              await prisma.action.createMany({
                data: extractedActions.map((action) => ({
                  userId,
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
                })),
              });
              extractedActionsCount += extractedActions.length;
            }

            await emailProvider.markEmailAsAnalyzed(messageId);
            processedCount++;
          } catch (error) {
            const msgId = emailMetadata.gmailMessageId || emailMetadata.imapUID?.toString() || "unknown";
            console.error(`Error processing email ${msgId}:`, error);
            skippedCount++;
          }
        }

        return { processedCount, extractedActionsCount, skippedCount };
      })
    );

    const totalProcessed = providerResults.reduce((sum, r) => sum + r.processedCount, 0);
    const totalExtracted = providerResults.reduce((sum, r) => sum + r.extractedActionsCount, 0);
    const totalSkipped = providerResults.reduce((sum, r) => sum + r.skippedCount, 0);

    if (totalExtracted > 0) {
      try {
        await sendActionDigest(session.user.id);
      } catch (notifError) {
        console.error("[Analyze] Error sending notification:", notifError);
      }
    }

    revalidatePath("/dashboard");
    revalidateTag(dashboardTag(session.user.id));

    return NextResponse.json({
      success: true,
      processedEmails: totalProcessed,
      extractedActions: totalExtracted,
      skippedEmails: totalSkipped,
      message: `${totalExtracted} action(s) extraite(s) depuis ${totalProcessed} email(s)`,
    });
  } catch (error) {
    console.error("Error analyzing emails:", error);
    return NextResponse.json({ error: "Erreur lors de l'analyse des emails" }, { status: 500 });
  } finally {
    await Promise.allSettled(providers.map((p) => p.disconnect()));
  }
}
