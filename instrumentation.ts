/**
 * Instrumentation Next.js
 * Ce fichier est exécuté au démarrage du serveur (dev et production)
 * Documentation: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Exécuter uniquement côté serveur
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startCronJobs } = await import("@/lib/cron/cron-service");

    console.log("[INSTRUMENTATION] Starting cron jobs...");
    startCronJobs();
    console.log("[INSTRUMENTATION] Cron jobs started successfully");
  }
}
