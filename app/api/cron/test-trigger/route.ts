import { NextRequest, NextResponse } from "next/server";
import { runDailySyncJob } from "@/lib/cron/daily-sync-job";
import { runCleanupJob } from "@/lib/cron/cleanup-job";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/test-trigger?job=daily-sync|cleanup
 * Endpoint de test pour déclencher manuellement les jobs cron
 * Utile pour tester sans attendre l'heure planifiée
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("[TEST TRIGGER] CRON_SECRET not configured");
    return NextResponse.json({ error: "Cron not configured" }, { status: 500 });
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    console.warn("[TEST TRIGGER] Unauthorized attempt");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = req.nextUrl.searchParams;
  const job = searchParams.get("job");

  if (!job) {
    return NextResponse.json(
      {
        error: "Missing 'job' parameter",
        usage: "/api/cron/test-trigger?job=daily-sync or /api/cron/test-trigger?job=cleanup",
      },
      { status: 400 }
    );
  }

  try {
    let result: unknown;

    switch (job) {
      case "daily-sync":
        console.log("[TEST TRIGGER] 🧪 Manually triggering daily-sync job");
        result = await runDailySyncJob();
        break;

      case "cleanup":
        console.log("[TEST TRIGGER] 🧪 Manually triggering cleanup job");
        result = await runCleanupJob();
        break;

      default:
        return NextResponse.json(
          {
            error: `Unknown job: ${job}`,
            available: ["daily-sync", "cleanup"],
          },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      job,
      result,
      message: `Job '${job}' executed successfully`,
    });
  } catch (error) {
    console.error("[TEST TRIGGER] ❌ Error executing job:", error);

    return NextResponse.json(
      {
        success: false,
        job,
        error: error instanceof Error ? error.message : "Unknown error",
        message: `Job '${job}' failed`,
      },
      { status: 500 }
    );
  }
}
