import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";

/**
 * GET /api/cron/cleanup-metadata
 * Nettoyage automatique des métadonnées d'emails obsolètes
 *
 * Appelé par cron (1x par jour à 23h00)
 * Sécurité: Vérification du header Authorization avec CRON_SECRET
 *
 * Stratégie de suppression :
 * - Tous les emails (ANALYZED ou EXTRACTED) plus vieux que 3 jours → Suppression
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

    console.log(`[CRON CLEANUP] Processing ${users.length} users`);

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
            `[CRON CLEANUP] User ${user.email}: deleted ${deleteResult.count} emails older than 3 days`
          );
        }
      } catch (userError) {
        console.error(
          `[CRON CLEANUP] ❌ Error processing user ${user.email}:`,
          userError
        );
        stats.errors.push(
          `${user.email}: ${userError instanceof Error ? userError.message : "Unknown error"}`
        );
      }
    }

    const duration = Date.now() - startTime;

    // Log final
    console.log(`[CRON CLEANUP] ✨ Cleanup completed in ${duration}ms`);
    console.log(`[CRON CLEANUP] Stats:`, {
      totalUsers: stats.totalUsers,
      totalDeleted: stats.totalDeleted,
      retentionDays: 3,
    });

    if (stats.errors.length > 0) {
      console.warn(`[CRON CLEANUP] Errors encountered:`, stats.errors);
    }

    return NextResponse.json({
      success: true,
      duration,
      stats: {
        totalUsers: stats.totalUsers,
        totalDeleted: stats.totalDeleted,
        errors: stats.errors,
      },
      retention: {
        days: 3,
      },
      message: `Cleanup completed: ${stats.totalDeleted} emails deleted`,
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
