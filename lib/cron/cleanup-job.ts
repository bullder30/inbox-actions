/**
 * Job de nettoyage des métadonnées d'emails obsolètes
 * Exécuté tous les jours à 23h00
 *
 * Stratégie de suppression :
 * - Tous les emails (ANALYZED ou EXTRACTED) plus vieux que 3 jours → Suppression
 */

import { prisma } from "@/lib/db";

export async function runCleanupJob() {
  const startTime = Date.now();

  console.log("[CLEANUP JOB] 🧹 Starting...");

  try {
    // Calculer la date de rétention : garder uniquement les 3 derniers jours
    const now = new Date();
    const retentionDate = new Date(now);
    retentionDate.setDate(retentionDate.getDate() - 3);

    // Récupérer tous les utilisateurs
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
      },
    });

    console.log(`[CLEANUP JOB] Processing ${users.length} users`);

    // Stats globales
    const stats = {
      totalUsers: users.length,
      totalDeleted: 0,
      errors: [] as string[],
    };

    // Traiter chaque utilisateur
    for (const user of users) {
      try {
        // Supprimer tous les emails (ANALYZED ou EXTRACTED) de plus de 3 jours
        const deleteResult = await prisma.emailMetadata.deleteMany({
          where: {
            userId: user.id,
            createdAt: {
              lt: retentionDate,
            },
          },
        });

        stats.totalDeleted += deleteResult.count;

        if (deleteResult.count > 0) {
          console.log(
            `[CLEANUP JOB] User ${user.email}: deleted ${deleteResult.count} emails older than 3 days`
          );
        }
      } catch (userError) {
        console.error(
          `[CLEANUP JOB] ❌ Error processing user ${user.email}:`,
          userError
        );
        stats.errors.push(
          `${user.email}: ${userError instanceof Error ? userError.message : "Unknown error"}`
        );
      }
    }

    const duration = Date.now() - startTime;

    console.log(`[CLEANUP JOB] ✨ Completed in ${duration}ms`);
    console.log(`[CLEANUP JOB] Stats:`, {
      totalUsers: stats.totalUsers,
      totalDeleted: stats.totalDeleted,
      retentionDays: 3,
    });

    if (stats.errors.length > 0) {
      console.warn(`[CLEANUP JOB] Errors:`, stats.errors);
    }

    return {
      success: true,
      stats,
      duration,
      retention: {
        days: 3,
      },
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("[CLEANUP JOB] ❌ Fatal error:", error);

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      duration,
    };
  }
}
