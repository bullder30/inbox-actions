import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createGmailService } from "@/lib/gmail/gmail-service";
import { extractActionsFromEmail } from "@/lib/actions/extract-actions-regex";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/daily-sync
 * Scan quotidien automatique des emails Gmail pour tous les utilisateurs
 *
 * Appelé par Vercel Cron (1x par jour)
 * Sécurité: Vérification du header Authorization avec CRON_SECRET
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now();

  try {
    // SÉCURITÉ: Vérifier que la requête vient bien de Vercel Cron
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error("[CRON] CRON_SECRET not configured");
      return NextResponse.json(
        { error: "Cron not configured" },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.warn("[CRON] Unauthorized cron attempt");
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log("[CRON] 🚀 Daily sync started");

    // Récupérer tous les utilisateurs avec Gmail connecté
    const usersWithGmail = await prisma.account.findMany({
      where: {
        provider: "google",
        access_token: { not: null },
      },
      select: {
        userId: true,
        user: {
          select: {
            id: true,
            email: true,
            lastGmailSync: true,
          },
        },
      },
      distinct: ["userId"], // Éviter les doublons si un user a plusieurs comptes Google
    });

    console.log(`[CRON] Found ${usersWithGmail.length} users with Gmail connected`);

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
        console.log(`[CRON] Processing user: ${userEmail} (${userId})`);

        // Créer le service Gmail
        const gmailService = await createGmailService(userId);

        if (!gmailService) {
          console.warn(`[CRON] ⚠️  Gmail service unavailable for ${userEmail} - token may be expired`);
          stats.failedUsers++;
          stats.errors.push(`${userEmail}: Gmail service unavailable (token expired?)`);
          continue;
        }

        // ÉTAPE 1: Synchroniser les nouveaux emails
        const newEmails = await gmailService.fetchNewEmails({
          maxResults: 100, // Limite raisonnable pour éviter les timeouts
          labelIds: ["INBOX"], // INBOX uniquement
        });

        console.log(`[CRON] ✅ Synced ${newEmails.length} new emails for ${userEmail}`);
        stats.totalEmailsSynced += newEmails.length;

        // ÉTAPE 2: Analyser les emails extraits (EXTRACTED) et extraire les actions
        const extractedEmails = await gmailService.getExtractedEmails();

        // Limiter à 50 emails par run pour éviter les timeouts
        const emailsToProcess = extractedEmails.slice(0, 50);

        let actionsExtracted = 0;

        for (const emailMetadata of emailsToProcess) {
          try {
            // Récupérer le corps de l'email (temporaire, en mémoire uniquement)
            const body = await gmailService.getEmailBodyForAnalysis(
              emailMetadata.gmailMessageId
            );

            if (!body) {
              console.warn(`[CRON] No body for email ${emailMetadata.gmailMessageId}, marking as analyzed anyway`);
              // Marquer comme analysé même si le body est vide
              await gmailService.markEmailAsAnalyzed(emailMetadata.gmailMessageId);
              continue;
            }

            // Extraire les actions avec REGEX (déterministe, pas d'IA opaque)
            const extractedActions = extractActionsFromEmail({
              from: emailMetadata.from,
              subject: emailMetadata.subject,
              body, // ⚠️ Utilisé UNIQUEMENT en mémoire, JAMAIS stocké
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

            // Marquer l'email comme analysé (ANALYZED) - même si aucune action extraite
            await gmailService.markEmailAsAnalyzed(emailMetadata.gmailMessageId);
          } catch (emailError) {
            console.error(
              `[CRON] Error processing email ${emailMetadata.gmailMessageId}:`,
              emailError
            );
            // Continuer avec les autres emails
          }
        }

        console.log(`[CRON] 📊 Extracted ${actionsExtracted} actions for ${userEmail}`);
        stats.totalActionsExtracted += actionsExtracted;
        stats.successUsers++;
      } catch (userError) {
        console.error(`[CRON] ❌ Error processing user ${userEmail}:`, userError);
        stats.failedUsers++;
        stats.errors.push(
          `${userEmail}: ${userError instanceof Error ? userError.message : "Unknown error"}`
        );
        // Continuer avec les autres utilisateurs
      }
    }

    const duration = Date.now() - startTime;

    // Log final
    console.log(`[CRON] ✨ Daily sync completed in ${duration}ms`);
    console.log(`[CRON] Stats:`, {
      totalUsers: stats.totalUsers,
      successUsers: stats.successUsers,
      failedUsers: stats.failedUsers,
      totalEmailsSynced: stats.totalEmailsSynced,
      totalActionsExtracted: stats.totalActionsExtracted,
    });

    if (stats.errors.length > 0) {
      console.warn(`[CRON] Errors encountered:`, stats.errors);
    }

    return NextResponse.json({
      success: true,
      duration,
      stats: {
        totalUsers: stats.totalUsers,
        successUsers: stats.successUsers,
        failedUsers: stats.failedUsers,
        totalEmailsSynced: stats.totalEmailsSynced,
        totalActionsExtracted: stats.totalActionsExtracted,
        errors: stats.errors,
      },
      message: `Processed ${stats.successUsers}/${stats.totalUsers} users successfully`,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("[CRON] ❌ Fatal error in daily sync:", error);

    return NextResponse.json(
      {
        success: false,
        duration,
        error: error instanceof Error ? error.message : "Unknown error",
        message: "Daily sync failed",
      },
      { status: 500 }
    );
  }
}
