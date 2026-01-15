/**
 * Script pour récupérer l'ID d'un utilisateur par son email
 * Usage: pnpm tsx scripts/get-user-id.ts <email>
 */

import { prisma } from "@/lib/db";

async function main() {
  const email = process.argv[2];

  if (!email) {
    console.error("❌ Usage: pnpm tsx scripts/get-user-id.ts <email>");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
      emailNotifications: true,
      lastNotificationSent: true,
    },
  });

  if (!user) {
    console.error(`❌ User not found: ${email}`);
    process.exit(1);
  }

  console.log("✅ User found:");
  console.log(`   ID: ${user.id}`);
  console.log(`   Name: ${user.name}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Notifications enabled: ${user.emailNotifications}`);
  console.log(`   Last notification: ${user.lastNotificationSent || "Never"}`);

  await prisma.$disconnect();
}

main();
