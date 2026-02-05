/**
 * Job de comptage des nouveaux emails
 * Exécuté toutes les 10 minutes
 *
 * IMPORTANT: Ce job NE synchronise PAS les emails, il compte uniquement
 * les nouveaux emails disponibles depuis la dernière synchro.
 *
 * La synchronisation réelle se fait via :
 * - Le bouton "Analyser" dans le dashboard (manuel)
 * - Le daily-sync job (automatique, 8h00)
 */

import { prisma } from "@/lib/db";
import { createEmailProvider } from "@/lib/email-provider/factory";

export async function runCountNewEmailsJob() {
  const startTime = Date.now();

  console.log("[COUNT-NEW-EMAILS JOB] 🔢 Starting...");

  try {
    // Récupérer tous les utilisateurs avec un email provider configuré
    const usersWithEmail = await prisma.user.findMany({
      where: {
        emailProvider: { in: ["MICROSOFT_GRAPH", "IMAP"] },
        syncEnabled: true,
      },
      select: {
        id: true,
        email: true,
        emailProvider: true,
      },
    });

    console.log(`[COUNT-NEW-EMAILS JOB] Found ${usersWithEmail.length} users with email configured`);

    // Stats globales
    const stats = {
      totalUsers: usersWithEmail.length,
      successUsers: 0,
      failedUsers: 0,
      totalNewEmails: 0,
      errors: [] as string[],
    };

    // Compter pour chaque utilisateur
    for (const user of usersWithEmail) {
      const userId = user.id;
      const userEmail = user.email || "unknown";

      try {
        // Créer le provider email
        const emailProvider = await createEmailProvider(userId);

        if (!emailProvider) {
          stats.failedUsers++;
          continue;
        }

        // UNIQUEMENT compter les nouveaux emails (pas de synchronisation)
        const newEmailsCount = await emailProvider.countNewEmails();

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
