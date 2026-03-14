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
import { createAllEmailProviders } from "@/lib/email-provider/factory";

export async function runCountNewEmailsJob() {
  const startTime = Date.now();

  console.log("[COUNT-NEW-EMAILS JOB] 🔢 Starting...");

  try {
    // Récupérer tous les utilisateurs avec au moins une boîte mail configurée
    const usersWithIMAPOrGraph = await prisma.user.findMany({
      where: {
        syncEnabled: true,
        OR: [
          { imapCredentials: { some: { isConnected: true } } },
          { microsoftGraphMailboxes: { some: { isActive: true } } },
        ],
      },
      select: {
        id: true,
        email: true,
      },
    });
    const usersWithEmail = usersWithIMAPOrGraph;

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
        // Créer tous les providers email de l'utilisateur (multi-boîtes)
        const emailProviders = await createAllEmailProviders(userId);

        if (emailProviders.length === 0) {
          stats.failedUsers++;
          continue;
        }

        // Compter les nouveaux emails sur toutes les boîtes (count cumulé)
        let userCount = 0;
        for (const provider of emailProviders) {
          userCount += await provider.countNewEmails();
        }

        if (userCount > 0) {
          console.log(`[COUNT-NEW-EMAILS JOB] ${userEmail}: ${userCount} new emails (${emailProviders.length} mailbox(es))`);
        }

        stats.totalNewEmails += userCount;
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
