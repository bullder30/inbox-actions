/**
 * Job de nettoyage des métadonnées d'emails
 * Exécuté tous les jours à 23h00
 *
 * Stratégie MVP : suppression de TOUTES les métadonnées (rétention = 0)
 * Les actions extraites sont conservées, seules les métadonnées temporaires sont supprimées.
 */

import { prisma } from "@/lib/db";

export async function runCleanupJob() {
  const startTime = Date.now();

  console.log("[CLEANUP JOB] 🧹 Starting...");

  try {
    // Supprimer TOUTES les métadonnées d'emails (MVP: rétention = 0)
    const deleteResult = await prisma.emailMetadata.deleteMany({});

    const duration = Date.now() - startTime;

    console.log(`[CLEANUP JOB] ✨ Completed in ${duration}ms`);
    console.log(`[CLEANUP JOB] Stats: ${deleteResult.count} email metadata deleted`);

    return {
      success: true,
      stats: {
        totalDeleted: deleteResult.count,
      },
      duration,
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
