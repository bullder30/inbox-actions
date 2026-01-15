/**
 * Job de comptage des nouveaux emails Gmail
 * Exécuté toutes les 10 minutes
 *
 * IMPORTANT: Ce job NE synchronise PAS les emails, il compte uniquement
 * les nouveaux emails disponibles dans Gmail depuis la dernière synchro.
 *
 * La synchronisation réelle se fait via :
 * - Le bouton "Analyser" dans le dashboard (manuel)
 * - Le daily-sync job (automatique, 8h00)
 */

import { prisma } from "@/lib/db";
import { createGmailService } from "@/lib/gmail/gmail-service";

export async function runCountNewEmailsJob() {
  const startTime = Date.now();

  console.log("[COUNT-NEW-EMAILS JOB] 🔢 Starting...");

  try {
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
          },
        },
      },
      distinct: ["userId"],
    });

    console.log(`[COUNT-NEW-EMAILS JOB] Found ${usersWithGmail.length} users with Gmail`);

    // Stats globales
    const stats = {
      totalUsers: usersWithGmail.length,
      successUsers: 0,
      failedUsers: 0,
      totalNewEmails: 0,
      errors: [] as string[],
    };

    // Compter pour chaque utilisateur
    for (const account of usersWithGmail) {
      const userId = account.userId;
      const userEmail = account.user.email || "unknown";

      try {
        // Créer le service Gmail
        const gmailService = await createGmailService(userId);

        if (!gmailService) {
          stats.failedUsers++;
          continue;
        }

        // UNIQUEMENT compter les nouveaux emails (pas de synchronisation)
        const newEmailsCount = await gmailService.countNewEmailsInGmail();

        if (newEmailsCount > 0) {
          console.log(`[COUNT-NEW-EMAILS JOB] ${userEmail}: ${newEmailsCount} new emails`);
        }

        stats.totalNewEmails += newEmailsCount;
        stats.successUsers++;
      } catch (userError) {
        console.error(`[COUNT-NEW-EMAILS JOB] Error for ${userEmail}:`, userError);
        stats.failedUsers++;
        stats.errors.push(
          `${userEmail}: ${userError instanceof Error ? userError.message : "Unknown error"}`
        );
      }
    }

    const duration = Date.now() - startTime;

    // Log uniquement si des nouveaux emails ont été détectés
    if (stats.totalNewEmails > 0) {
      console.log(`[COUNT-NEW-EMAILS JOB] ✨ Found ${stats.totalNewEmails} new emails (${duration}ms)`);
    }

    return {
      success: true,
      stats,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("[COUNT-NEW-EMAILS JOB] ❌ Fatal error:", error);

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      duration,
    };
  }
}
