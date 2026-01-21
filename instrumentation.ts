/**
 * Instrumentation Next.js
 * Ce fichier est exécuté au démarrage du serveur (dev et production)
 * Documentation: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 *
 * CRON_PROVIDER:
 * - "node" (défaut): utilise node-cron, pour dev local ou serveurs persistants
 * - "vercel": désactive node-cron, les crons sont gérés par Vercel Cron (vercel.json)
 */

export async function register() {
  // Exécuter uniquement côté serveur
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const cronProvider = process.env.CRON_PROVIDER || "node";

    if (cronProvider === "node") {
      const { startCronJobs } = await import("@/lib/cron/cron-service");

      console.log("[INSTRUMENTATION] Starting node-cron jobs...");
      startCronJobs();
      console.log("[INSTRUMENTATION] Node-cron jobs started successfully");
    } else if (cronProvider === "vercel") {
      console.log("[INSTRUMENTATION] Cron provider: Vercel (node-cron disabled)");
    } else {
      console.warn(`[INSTRUMENTATION] Unknown CRON_PROVIDER: ${cronProvider}, defaulting to node-cron`);
      const { startCronJobs } = await import("@/lib/cron/cron-service");
      startCronJobs();
    }
  }
}
