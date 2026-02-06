/**
 * Job de synchronisation quotidienne (Gmail et IMAP)
 * Exécuté tous les jours à 8h00
 * Plus agressif que l'auto-sync (100 emails sync, 50 emails analyze)
 */

import { prisma } from "@/lib/db";
import { createEmailProvider } from "@/lib/email-provider/factory";
import { extractActionsFromEmail } from "@/lib/actions/extract-actions-regex";
import { sendActionDigest } from "@/lib/notifications/action-digest-service";

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
    // Récupérer tous les utilisateurs avec sync activé et un provider email configuré
    // Cas 1: Microsoft Graph connecté (account microsoft-entra-id avec access_token)
    const usersWithMicrosoftGraph = await prisma.account.findMany({
      where: {
        provider: "microsoft-entra-id",
        access_token: { not: null },
        user: {
          syncEnabled: true,
          emailProvider: "MICROSOFT_GRAPH",
        },
      },
      select: {
        userId: true,
        user: {
          select: {
            id: true,
            email: true,
            emailProvider: true,
          },
        },
      },
      distinct: ["userId"],
    });

    // Cas 2: IMAP connecté
    const usersWithIMAP = await prisma.iMAPCredential.findMany({
      where: {
        isConnected: true,
        user: {
          syncEnabled: true,
          emailProvider: "IMAP",
        },
      },
      select: {
        userId: true,
        user: {
          select: {
            id: true,
            email: true,
            emailProvider: true,
          },
        },
      },
      distinct: ["userId"],
    });

    // Combiner les listes (éviter les doublons par userId)
    const allUsersMap = new Map<string, { id: string; email: string | null; emailProvider: string | null }>();

    for (const account of usersWithMicrosoftGraph) {
      allUsersMap.set(account.userId, {
        id: account.user.id,
        email: account.user.email,
        emailProvider: account.user.emailProvider,
      });
    }

    for (const credential of usersWithIMAP) {
      if (!allUsersMap.has(credential.userId)) {
        allUsersMap.set(credential.userId, {
          id: credential.user.id,
          email: credential.user.email,
          emailProvider: credential.user.emailProvider,
        });
      }
    }

    const allUsers = Array.from(allUsersMap.values());

    console.log(`[DAILY-SYNC JOB] Found ${allUsers.length} users with email connected and sync enabled`);
    console.log(`[DAILY-SYNC JOB]   - Microsoft Graph: ${usersWithMicrosoftGraph.length} users`);
    console.log(`[DAILY-SYNC JOB]   - IMAP: ${usersWithIMAP.length} users`);

    // Stats globales
    const stats = {
      totalUsers: allUsers.length,
      successUsers: 0,
      failedUsers: 0,
      totalEmailsSynced: 0,
      totalActionsExtracted: 0,
      errors: [] as string[],
    };

    // Traiter chaque utilisateur
    for (const userData of allUsers) {
      const userId = userData.id;
      const userEmail = userData.email || "unknown";
      const provider = userData.emailProvider;

      try {
        console.log(`[DAILY-SYNC JOB] Processing user: ${userEmail} (${provider})`);

        // Créer le provider email (Gmail ou IMAP selon la config utilisateur)
        const emailProvider = await createEmailProvider(userId);

        if (!emailProvider) {
          console.warn(`[DAILY-SYNC JOB] ⚠️  Email service unavailable for ${userEmail}`);
          stats.failedUsers++;
          stats.errors.push(`${userEmail}: Email service unavailable (token expired or credentials invalid?)`);
          continue;
        }

        // ÉTAPE 1: Synchroniser les nouveaux emails (100 max pour le daily sync)
        const newEmails = await emailProvider.fetchNewEmails({
          maxResults: 100,
          folder: "INBOX",
        });

        console.log(`[DAILY-SYNC JOB] ✅ Synced ${newEmails.length} emails for ${userEmail}`);
        stats.totalEmailsSynced += newEmails.length;

        // ÉTAPE 2: Analyser les emails EXTRACTED (50 max pour le daily sync)
        const extractedEmails = await emailProvider.getExtractedEmails();
        const emailsToAnalyze = extractedEmails.slice(0, 50);

        let actionsExtracted = 0;

        for (const emailMetadata of emailsToAnalyze) {
          try {
            const messageId = getMessageId(emailMetadata);

            // Récupérer le corps de l'email
            const body = await emailProvider.getEmailBodyForAnalysis(messageId);

            if (!body) {
              // Marquer comme analysé même si le body est vide
              await emailProvider.markEmailAsAnalyzed(messageId);
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
                  gmailMessageId: emailMetadata.gmailMessageId, // null si IMAP
                  imapUID: emailMetadata.imapUID, // null si Gmail
                  emailWebUrl: emailMetadata.webUrl, // URL vers l'email dans le webmail
                  dueDate: action.dueDate,
                  status: "TODO",
                },
              });

              actionsExtracted++;
            }

            // Marquer l'email comme analysé
            await emailProvider.markEmailAsAnalyzed(messageId);
          } catch (emailError) {
            const messageIdStr = emailMetadata.gmailMessageId || emailMetadata.imapUID?.toString() || "unknown";
            console.error(
              `[DAILY-SYNC JOB] Error analyzing email ${messageIdStr}:`,
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
