import { NextRequest, NextResponse } from "next/server";
import { runDailySyncJob } from "@/lib/cron/daily-sync-job";

export const dynamic = "force-dynamic";

// Augmenter le timeout pour Vercel (max 60s sur plan hobby, 300s sur pro)
export const maxDuration = 60;

/**
 * GET /api/cron/daily-sync
 * Endpoint pour déclencher le job de synchronisation quotidienne
 *
 * Utilisé par:
 * - Vercel Cron (production)
 * - Appels manuels pour tests
 *
 * Supporte Gmail ET IMAP via le factory pattern
 *
 * Sécurité: Vérification du header Authorization avec CRON_SECRET
 */
export async function GET(req: NextRequest) {
  try {
    // SÉCURITÉ: Vérifier que la requête vient bien de Vercel Cron ou est autorisée
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error("[CRON API] CRON_SECRET not configured");
      return NextResponse.json(
        { error: "Cron not configured" },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.warn("[CRON API] Unauthorized cron attempt");
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log("[CRON API] 🚀 Triggering daily sync job...");

    // Exécuter le job de sync (dual-provider: Gmail + IMAP)
    const result = await runDailySyncJob();

    if (result.success) {
      return NextResponse.json({
        success: true,
        duration: result.duration,
        stats: result.stats,
        message: `Processed ${result.stats?.successUsers}/${result.stats?.totalUsers} users successfully`,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          duration: result.duration,
          error: result.error,
          message: "Daily sync failed",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[CRON API] ❌ Fatal error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        message: "Daily sync failed",
      },
      { status: 500 }
    );
  }
}
