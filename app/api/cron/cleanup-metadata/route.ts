import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";

/**
 * GET /api/cron/cleanup-metadata
 * Nettoyage automatique des métadonnées d'emails
 *
 * Appelé par cron (1x par jour à 23h00)
 * Sécurité: Vérification du header Authorization avec CRON_SECRET
 *
 * Stratégie MVP : suppression de TOUTES les métadonnées (rétention = 0)
 * Les actions extraites sont conservées, seules les métadonnées temporaires sont supprimées.
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now();

  try {
    // SÉCURITÉ: Vérifier que la requête vient bien de Vercel Cron
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error("[CRON CLEANUP] CRON_SECRET not configured");
      return NextResponse.json(
        { error: "Cron not configured" },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.warn("[CRON CLEANUP] Unauthorized cron attempt");
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log("[CRON CLEANUP] 🧹 Cleanup started");

    // Supprimer TOUTES les métadonnées d'emails (MVP: rétention = 0)
    const deleteResult = await prisma.emailMetadata.deleteMany({});

    const duration = Date.now() - startTime;

    console.log(`[CRON CLEANUP] ✨ Cleanup completed in ${duration}ms`);
    console.log(`[CRON CLEANUP] Stats: ${deleteResult.count} email metadata deleted`);

    return NextResponse.json({
      success: true,
      duration,
      stats: {
        totalDeleted: deleteResult.count,
      },
      message: `Cleanup completed: ${deleteResult.count} email metadata deleted`,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("[CRON CLEANUP] ❌ Fatal error in cleanup:", error);

    return NextResponse.json(
      {
        success: false,
        duration,
        error: error instanceof Error ? error.message : "Unknown error",
        message: "Cleanup failed",
      },
      { status: 500 }
    );
  }
}
