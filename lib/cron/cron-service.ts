/**
 * Service de cron pour toutes les tâches planifiées
 * Utilise node-cron pour exécuter les jobs à intervalles réguliers
 */

import * as cron from "node-cron";

import { runCleanupJob } from "./cleanup-job";
import { runCountNewEmailsJob } from "./count-new-emails-job";
import { runDailySyncJob } from "./daily-sync-job";

let countNewEmailsTask: cron.ScheduledTask | null = null;
let dailySyncTask: cron.ScheduledTask | null = null;
let cleanupTask: cron.ScheduledTask | null = null;

/**
 * Démarre tous les crons
 */
export function startCronJobs() {
  console.log("[CRON SERVICE] 🚀 Starting cron jobs...");

  // Count new emails job: toutes les 10 minutes (optional, controlled by FEATURE_EMAIL_COUNT)
  const isEmailCountEnabled = process.env.FEATURE_EMAIL_COUNT === "true";

  if (isEmailCountEnabled && !countNewEmailsTask) {
    countNewEmailsTask = cron.schedule(
      "*/10 * * * *", // Toutes les 10 minutes
      async () => {
        console.log("[CRON SERVICE] ⏰ Count-new-emails job triggered at", new Date().toISOString());
        try {
          await runCountNewEmailsJob();
        } catch (error) {
          console.error("[CRON SERVICE] Error running count-new-emails job:", error);
        }
      },
      {
        scheduled: true,
        timezone: "Europe/Paris",
      } as any
    );

    console.log("[CRON SERVICE] ✅ Count-new-emails job scheduled (every 10 minutes)");
  } else if (!isEmailCountEnabled) {
    console.log("[CRON SERVICE] ⏭️ Count-new-emails job disabled (FEATURE_EMAIL_COUNT=false)");
  }

  // Daily-sync job: tous les jours à 8h00
  if (!dailySyncTask) {
    dailySyncTask = cron.schedule(
      "18 16 * * *", // TEST: 15h43   
      async () => {
        console.log("[CRON SERVICE] ⏰ Daily-sync job triggered");
        try {
          await runDailySyncJob();
        } catch (error) {
          console.error("[CRON SERVICE] Error running daily-sync job:", error);
        }
      },
      {
        scheduled: true,
        timezone: "Europe/Paris",
      } as any
    );

    console.log("[CRON SERVICE] ✅ Daily-sync job scheduled (every day at 8:00 AM)");
  }

  // Cleanup job: tous les jours à 23h00
  if (!cleanupTask) {
    cleanupTask = cron.schedule(
      "15 16 * * *", // TEST: 15h40
      async () => {
        console.log("[CRON SERVICE] ⏰ Cleanup job triggered");
        try {
          await runCleanupJob();
        } catch (error) {
          console.error("[CRON SERVICE] Error running cleanup job:", error);
        }
      },
      {
        scheduled: true,
        timezone: "Europe/Paris",
      } as any
    );

    console.log("[CRON SERVICE] ✅ Cleanup job scheduled (every day at 11:00 PM)");
  }
}

/**
 * Arrête tous les crons
 */
export function stopCronJobs() {
  console.log("[CRON SERVICE] 🛑 Stopping cron jobs...");

  if (countNewEmailsTask) {
    countNewEmailsTask.stop();
    countNewEmailsTask = null;
  }

  if (dailySyncTask) {
    dailySyncTask.stop();
    dailySyncTask = null;
  }

  if (cleanupTask) {
    cleanupTask.stop();
    cleanupTask = null;
  }

  console.log("[CRON SERVICE] ✅ Cron jobs stopped");
}

/**
 * Vérifie si les crons sont actifs
 */
export function isCronRunning() {
  const isEmailCountEnabled = process.env.FEATURE_EMAIL_COUNT === "true";
  const emailCountOk = isEmailCountEnabled ? countNewEmailsTask !== null : true;
  return emailCountOk && dailySyncTask !== null && cleanupTask !== null;
}
