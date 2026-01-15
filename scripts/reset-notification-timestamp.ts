/**
 * Script pour réinitialiser le timestamp de dernière notification
 * Utile pour tester sans attendre 30 minutes
 * Usage: pnpm tsx scripts/reset-notification-timestamp.ts <email>
 */

import { prisma } from "@/lib/db";

async function main() {
  const email = process.argv[2];

  if (!email) {
    console.error("❌ Usage: pnpm tsx scripts/reset-notification-timestamp.ts <email>");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      lastNotificationSent: true,
    },
  });

  if (!user) {
    console.error(`❌ User not found: ${email}`);
    process.exit(1);
  }

  console.log(`📧 User: ${user.email}`);
  console.log(`   Last notification sent: ${user.lastNotificationSent || "Never"}`);

  // Reset le timestamp
  await prisma.user.update({
    where: { id: user.id },
    data: { lastNotificationSent: null },
  });

  console.log("✅ Timestamp reset! You can now test the notification.");

  await prisma.$disconnect();
}

main();
