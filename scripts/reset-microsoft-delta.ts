/**
 * Script pour réinitialiser le deltaLink Microsoft Graph
 * Nécessaire après l'ajout de webLink au $select
 *
 * Usage: npx tsx scripts/reset-microsoft-delta.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔄 Resetting Microsoft Graph delta links...\n");

  // Trouver tous les utilisateurs avec un deltaLink
  const usersWithDelta = await prisma.user.findMany({
    where: {
      microsoftDeltaLink: { not: null },
    },
    select: {
      id: true,
      email: true,
      microsoftDeltaLink: true,
    },
  });

  console.log(`Found ${usersWithDelta.length} user(s) with deltaLink\n`);

  for (const user of usersWithDelta) {
    console.log(`- ${user.email}: clearing deltaLink`);

    await prisma.user.update({
      where: { id: user.id },
      data: { microsoftDeltaLink: null },
    });
  }

  // Supprimer aussi les métadonnées Microsoft Graph pour forcer une resync complète
  const deletedMetadata = await prisma.emailMetadata.deleteMany({
    where: {
      emailProvider: "MICROSOFT_GRAPH",
    },
  });

  console.log(`\n✅ Cleared ${usersWithDelta.length} deltaLink(s)`);
  console.log(`✅ Deleted ${deletedMetadata.count} email metadata record(s)`);
  console.log("\nUsers will get a fresh sync on next request.");
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
