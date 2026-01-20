/**
 * Job de synchronisation quotidienne Gmail
 * Exécuté tous les jours à 8h00
 * Plus agressif que l'auto-sync (100 emails sync, 50 emails analyze)
 */

import { prisma } from "@/lib/db";
import { createGmailService } from "@/lib/gmail/gmail-service";
import { extractActionsFromEmail } from "@/lib/actions/extract-actions-regex";
import { sendActionDigest } from "@/lib/notifications/action-digest-service";

export async function runDailySyncJob() {
  const startTime = Date.now();

  console.log("[DAILY-SYNC JOB] 🚀 Starting...");

  try {
    // Récupérer tous les utilisateurs avec Gmail connecté et sync activé
    const usersWithGmail = await prisma.account.findMany({
      where: {
        provider: "google",
        access_token: { not: null },
        user: {
          syncEnabled: true,
        },
      },
      select: {
        userId: true,
        user: {
          select: {
            id: true,
            email: true,
            lastGmailSync: true,
            syncEnabled: true,
          },
        },
      },
      distinct: ["userId"],
    });

    console.log(`[DAILY-SYNC JOB] Found ${usersWithGmail.length} users with Gmail connected and sync enabled`);

    // Stats globales
    const stats = {
      totalUsers: usersWithGmail.length,
      successUsers: 0,
      failedUsers: 0,
      totalEmailsSynced: 0,
      totalActionsExtracted: 0,
      errors: [] as string[],
    };

    // Traiter chaque utilisateur
    for (const account of usersWithGmail) {
      const userId = account.userId;
      const userEmail = account.user.email || "unknown";

      try {
        console.log(`[DAILY-SYNC JOB] Processing user: ${userEmail}`);

        // Créer le service Gmail
        const gmailService = await createGmailService(userId);

        if (!gmailService) {
          console.warn(`[DAILY-SYNC JOB] ⚠️  Gmail service unavailable for ${userEmail}`);
          stats.failedUsers++;
          stats.errors.push(`${userEmail}: Gmail service unavailable (token expired?)`);
          continue;
        }

        // ÉTAPE 1: Synchroniser les nouveaux emails (100 max pour le daily sync)
        const newEmails = await gmailService.fetchNewEmails({
          maxResults: 100,
          labelIds: ["INBOX"],
        });

        console.log(`[DAILY-SYNC JOB] ✅ Synced ${newEmails.length} emails for ${userEmail}`);
        stats.totalEmailsSynced += newEmails.length;

        // ÉTAPE 2: Analyser les emails EXTRACTED (50 max pour le daily sync)
        const extractedEmails = await gmailService.getExtractedEmails();
        const emailsToAnalyze = extractedEmails.slice(0, 50);

        let actionsExtracted = 0;

        for (const emailMetadata of emailsToAnalyze) {
          try {
            // Récupérer le corps de l'email
            const body = await gmailService.getEmailBodyForAnalysis(
              emailMetadata.gmailMessageId
            );

            if (!body) {
              // Marquer comme analysé même si le body est vide
              await gmailService.markEmailAsAnalyzed(emailMetadata.gmailMessageId);
              continue;
            }

            // Extraire les actions avec REGEX
            const extractedActions = extractActionsFromEmail({
              from: emailMetadata.from,
              subject: emailMetadata.subject,
              body,
              receivedAt: emailMetadata.receivedAt,
            });

            // Stocker les actions extraites (s'il y en a)
            for (const action of extractedActions) {
              await prisma.action.create({
                data: {
                  userId,
                  title: action.title,
                  type: action.type,
                  sourceSentence: action.sourceSentence,
                  emailFrom: emailMetadata.from,
                  emailReceivedAt: emailMetadata.receivedAt,
                  dueDate: action.dueDate,
                  status: "TODO",
                },
              });

              actionsExtracted++;
            }

            // Marquer l'email comme analysé
            await gmailService.markEmailAsAnalyzed(emailMetadata.gmailMessageId);
          } catch (emailError) {
            console.error(
              `[DAILY-SYNC JOB] Error analyzing email ${emailMetadata.gmailMessageId}:`,
              emailError
            );
          }
        }

        console.log(
          `[DAILY-SYNC JOB] 📊 ${userEmail}: ${actionsExtracted} actions extracted`
        );
        stats.totalActionsExtracted += actionsExtracted;
        stats.successUsers++;

        // Envoyer la notification si des emails ont été extraits ou analysés
        // Ne pas bloquer le cron en cas d'erreur
        if (newEmails.length > 0 || actionsExtracted > 0) {
          sendActionDigest(userId).catch((error) => {
            console.error(`[DAILY-SYNC JOB] Error sending notification to ${userEmail}:`, error);
          });
        }
      } catch (userError) {
        console.error(`[DAILY-SYNC JOB] ❌ Error for ${userEmail}:`, userError);
        stats.failedUsers++;
        stats.errors.push(
          `${userEmail}: ${userError instanceof Error ? userError.message : "Unknown error"}`
        );
      }
    }

    const duration = Date.now() - startTime;

    console.log(`[DAILY-SYNC JOB] ✨ Completed in ${duration}ms`);
    console.log(`[DAILY-SYNC JOB] Stats:`, {
      users: `${stats.successUsers}/${stats.totalUsers}`,
      synced: stats.totalEmailsSynced,
      actions: stats.totalActionsExtracted,
    });

    if (stats.errors.length > 0) {
      console.warn(`[DAILY-SYNC JOB] Errors:`, stats.errors);
    }

    return {
      success: true,
      stats,
      duration,
    };
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
