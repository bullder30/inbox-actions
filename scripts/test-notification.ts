/**
 * Script de test pour les notifications email
 * Usage: pnpm tsx scripts/test-notification.ts <userId>
 */

import { sendActionDigest } from "@/lib/notifications/action-digest-service";

async function main() {
  const userId = process.argv[2];

  if (!userId) {
    console.error("❌ Usage: pnpm tsx scripts/test-notification.ts <userId>");
    process.exit(1);
  }

  console.log(`🧪 Testing email notification for user ${userId}...`);

  try {
    const result = await sendActionDigest(userId);

    if (result) {
      console.log("✅ Email sent successfully!");
    } else {
      console.log("⚠️  Email not sent (check logs for reason)");
    }
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

main();
