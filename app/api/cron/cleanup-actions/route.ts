import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/cleanup-actions
 * Supprime toutes les actions (pour tests MVP uniquement)
 *
 * ⚠️ ENDPOINT MANUEL - Non ajouté au schedule Vercel Cron
 * Sécurité: Vérification du header Authorization avec CRON_SECRET
 *
 * Usage:
 * curl -H "Authorization: Bearer <CRON_SECRET>" https://inbox-actions.vercel.app/api/cron/cleanup-actions
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now();

  try {
    // SÉCURITÉ: Vérifier que la requête est autorisée
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error("[CLEANUP-ACTIONS] CRON_SECRET not configured");
      return NextResponse.json(
        { error: "Cron not configured" },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.warn("[CLEANUP-ACTIONS] Unauthorized attempt");
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log("[CLEANUP-ACTIONS] 🗑️ Starting cleanup...");

    // Compter les actions avant suppression
    const countBefore = await prisma.action.count();

    // Supprimer toutes les actions
    const result = await prisma.action.deleteMany({});

    const duration = Date.now() - startTime;

    console.log(`[CLEANUP-ACTIONS] ✨ Deleted ${result.count} actions in ${duration}ms`);

    return NextResponse.json({
      success: true,
      duration,
      stats: {
        deletedCount: result.count,
        countBefore,
      },
      message: `Deleted ${result.count} actions`,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("[CLEANUP-ACTIONS] ❌ Error:", error);

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
