/**
 * Job de synchronisation quotidienne
 * Exécuté tous les jours à 7h00
 * Itère sur chaque mailbox configurée (IMAP ou Microsoft Graph)
 */

import { prisma } from "@/lib/db";
import { createIMAPServiceById } from "@/lib/imap/imap-service";
import { createMicrosoftGraphServiceByMailbox } from "@/lib/microsoft-graph/graph-service";
import { IMAPProvider } from "@/lib/email-provider/imap-provider";
import { MicrosoftGraphProvider } from "@/lib/email-provider/microsoft-graph-provider";
import { extractActionsFromEmail, type UserExclusionData } from "@/lib/actions/extract-actions-regex";
import { getEndOfTodayParis } from "@/lib/utils/date-paris";
import { sendActionDigest } from "@/lib/notifications/action-digest-service";
import { MAX_EMAILS_TO_SYNC, MAX_EMAILS_TO_ANALYZE } from "@/lib/config/sync";
import type { IEmailProvider } from "@/lib/email-provider/interface";

/**
 * Helper pour obtenir l'identifiant du message selon le provider
 */
function getMessageId(email: { gmailMessageId?: string | null; imapUID?: bigint | null }): string | bigint {
  if (email.gmailMessageId) return email.gmailMessageId;
  if (email.imapUID) return email.imapUID;
  throw new Error("No message ID found");
}

export async function runDailySyncJob() {
  const startTime = Date.now();

  console.log("[DAILY-SYNC JOB] 🚀 Starting...");

  try {
    // --- Collecter toutes les mailboxes à synchroniser ---

    // Cas 1: Credentials IMAP connectées (utilisateurs avec syncEnabled)
    const imapCredentials = await prisma.iMAPCredential.findMany({
      where: {
        isConnected: true,
        user: { syncEnabled: true },
      },
      select: {
        id: true,
        label: true,
        imapUsername: true,
        userId: true,
        user: { select: { id: true, email: true } },
      },
    });

    // Cas 2: Boîtes Microsoft Graph actives (utilisateurs avec syncEnabled)
    const graphMailboxes = await prisma.microsoftGraphMailbox.findMany({
      where: {
        isActive: true,
        user: { syncEnabled: true },
      },
      select: {
        id: true,
        label: true,
        email: true,
        userId: true,
        user: { select: { id: true, email: true } },
      },
    });

    console.log(`[DAILY-SYNC JOB] Found ${imapCredentials.length} IMAP mailbox(es) and ${graphMailboxes.length} Microsoft Graph mailbox(es)`);

    const stats = {
      totalMailboxes: imapCredentials.length + graphMailboxes.length,
      successMailboxes: 0,
      failedMailboxes: 0,
      totalEmailsSynced: 0,
      totalActionsExtracted: 0,
      errors: [] as string[],
    };

    // --- Traiter chaque mailbox IMAP ---
    for (const credential of imapCredentials) {
      const userEmail = credential.user.email || "unknown";
      const mailboxLabel = credential.label || credential.imapUsername;
      let provider: IEmailProvider | null = null;

      try {
        console.log(`[DAILY-SYNC JOB] Processing IMAP: ${mailboxLabel} (user: ${userEmail})`);

        const service = await createIMAPServiceById(credential.id, credential.userId);
        if (!service) {
          console.warn(`[DAILY-SYNC JOB] ⚠️  IMAP service unavailable for ${mailboxLabel}`);
          stats.failedMailboxes++;
          stats.errors.push(`${mailboxLabel}: IMAP service unavailable`);
          continue;
        }

        provider = new IMAPProvider(service, credential.id, mailboxLabel);

        const userExclusions = await prisma.userExclusion.findMany({
          where: { userId: credential.userId },
          select: { type: true, value: true },
        }) as UserExclusionData[];

        const result = await syncAndAnalyzeMailbox(provider, credential.userId, mailboxLabel, userExclusions);
        stats.totalEmailsSynced += result.synced;
        stats.totalActionsExtracted += result.actions;
        stats.successMailboxes++;

        if (result.synced > 0 || result.actions > 0) {
          try {
            await sendActionDigest(credential.userId);
          } catch (notifError) {
            console.error(`[DAILY-SYNC JOB] 📧 sendActionDigest ERROR for ${userEmail}:`, notifError);
          }
        }
      } catch (err) {
        console.error(`[DAILY-SYNC JOB] ❌ Error for IMAP ${mailboxLabel}:`, err);
        stats.failedMailboxes++;
        stats.errors.push(`${mailboxLabel}: ${err instanceof Error ? err.message : "Unknown error"}`);
      } finally {
        if (provider) {
          try { await provider.disconnect(); } catch {}
        }
      }
    }

    // --- Traiter chaque mailbox Microsoft Graph ---
    for (const mailbox of graphMailboxes) {
      const userEmail = mailbox.user.email || "unknown";
      const mailboxLabel = mailbox.label || mailbox.email || "Microsoft";
      let provider: IEmailProvider | null = null;

      try {
        console.log(`[DAILY-SYNC JOB] Processing Graph: ${mailboxLabel} (user: ${userEmail})`);

        const service = await createMicrosoftGraphServiceByMailbox(mailbox.id, mailbox.userId);
        if (!service) {
          console.warn(`[DAILY-SYNC JOB] ⚠️  Graph service unavailable for ${mailboxLabel}`);
          stats.failedMailboxes++;
          stats.errors.push(`${mailboxLabel}: Graph service unavailable (token expired?)`);
          continue;
        }

        provider = new MicrosoftGraphProvider(service, mailbox.userId, mailboxLabel);

        const userExclusions = await prisma.userExclusion.findMany({
          where: { userId: mailbox.userId },
          select: { type: true, value: true },
        }) as UserExclusionData[];

        const result = await syncAndAnalyzeMailbox(provider, mailbox.userId, mailboxLabel, userExclusions);
        stats.totalEmailsSynced += result.synced;
        stats.totalActionsExtracted += result.actions;
        stats.successMailboxes++;

        if (result.synced > 0 || result.actions > 0) {
          try {
            await sendActionDigest(mailbox.userId);
          } catch (notifError) {
            console.error(`[DAILY-SYNC JOB] 📧 sendActionDigest ERROR for ${userEmail}:`, notifError);
          }
        }
      } catch (err) {
        console.error(`[DAILY-SYNC JOB] ❌ Error for Graph ${mailboxLabel}:`, err);
        stats.failedMailboxes++;
        stats.errors.push(`${mailboxLabel}: ${err instanceof Error ? err.message : "Unknown error"}`);
      } finally {
        if (provider) {
          try { await provider.disconnect(); } catch {}
        }
      }
    }

    const duration = Date.now() - startTime;

    console.log(`[DAILY-SYNC JOB] ✨ Completed in ${duration}ms`);
    console.log(`[DAILY-SYNC JOB] Stats:`, {
      mailboxes: `${stats.successMailboxes}/${stats.totalMailboxes}`,
      synced: stats.totalEmailsSynced,
      actions: stats.totalActionsExtracted,
    });

    if (stats.errors.length > 0) {
      console.warn(`[DAILY-SYNC JOB] Errors:`, stats.errors);
    }

    return { success: true, stats, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("[DAILY-SYNC JOB] ❌ Fatal error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      duration,
    };
  }
}

/**
 * Synchronise et analyse les emails d'une mailbox.
 * Retourne les stats de synchro et d'extraction.
 */
async function syncAndAnalyzeMailbox(
  provider: IEmailProvider,
  userId: string,
  mailboxLabel: string,
  userExclusions: UserExclusionData[] = []
): Promise<{ synced: number; actions: number }> {
  // ÉTAPE 1: Synchroniser les nouveaux emails
  const newEmails = await provider.fetchNewEmails({
    maxResults: MAX_EMAILS_TO_SYNC,
    folder: "INBOX",
  });
  console.log(`[DAILY-SYNC JOB] ✅ Synced ${newEmails.length} emails for ${mailboxLabel}`);

  // ÉTAPE 2: Analyser les emails EXTRACTED
  const extractedEmails = await provider.getExtractedEmails();
  const emailsToAnalyze = extractedEmails.slice(0, MAX_EMAILS_TO_ANALYZE);

  let actionsExtracted = 0;

  for (const emailMetadata of emailsToAnalyze) {
    try {
      const messageId = getMessageId(emailMetadata);
      const body = await provider.getEmailBodyForAnalysis(messageId);

      if (!body) {
        await provider.markEmailAsAnalyzed(messageId);
        continue;
      }

      const extractedActions = extractActionsFromEmail({
        from: emailMetadata.from,
        subject: emailMetadata.subject,
        body,
        receivedAt: emailMetadata.receivedAt,
      }, userExclusions);

      for (const action of extractedActions) {
        await prisma.action.create({
          data: {
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
            mailboxId: provider.mailboxId,
            mailboxLabel: provider.mailboxLabel,
          },
        });
        actionsExtracted++;
      }

      await provider.markEmailAsAnalyzed(messageId);
    } catch (emailError) {
      const msgId = emailMetadata.gmailMessageId || emailMetadata.imapUID?.toString() || "unknown";
      console.error(`[DAILY-SYNC JOB] Error analyzing email ${msgId}:`, emailError);
    }
  }

  console.log(`[DAILY-SYNC JOB] 📊 ${mailboxLabel}: ${actionsExtracted} actions extracted`);
  return { synced: newEmails.length, actions: actionsExtracted };
}
