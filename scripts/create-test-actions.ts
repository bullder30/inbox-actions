/**
 * Script pour créer des actions de test
 * Usage: pnpm tsx scripts/create-test-actions.ts <email>
 */

import { prisma } from "@/lib/db";

async function main() {
  const email = process.argv[2];

  if (!email) {
    console.error("❌ Usage: pnpm tsx scripts/create-test-actions.ts <email>");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });

  if (!user) {
    console.error(`❌ User not found: ${email}`);
    process.exit(1);
  }

  console.log(`📧 Creating test actions for ${user.email}...`);

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(18, 0, 0, 0);

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  const inTwoHours = new Date(now);
  inTwoHours.setHours(inTwoHours.getHours() + 2);

  // Créer 5 actions de test
  const actions = [
    {
      title: "Appeler le client ABC",
      type: "CALL" as const,
      sourceSentence: "Merci d'appeler le client ABC pour discuter du projet",
      dueDate: inTwoHours, // Urgent (dans 2h)
      emailFrom: "boss@company.com",
      emailReceivedAt: now,
    },
    {
      title: "Envoyer le rapport Q4",
      type: "SEND" as const,
      sourceSentence: "Pourrais-tu m'envoyer le rapport du Q4 aujourd'hui ?",
      dueDate: yesterday, // En retard !
      emailFrom: "manager@company.com",
      emailReceivedAt: yesterday,
    },
    {
      title: "Valider le design",
      type: "VALIDATE" as const,
      sourceSentence: "N'oublie pas de valider le nouveau design avant demain",
      dueDate: tomorrow, // Normal
      emailFrom: "designer@company.com",
      emailReceivedAt: now,
    },
    {
      title: "Payer la facture",
      type: "PAY" as const,
      sourceSentence: "Merci de payer la facture #12345",
      dueDate: null, // Pas de deadline
      emailFrom: "accounting@company.com",
      emailReceivedAt: now,
    },
    {
      title: "Relancer le fournisseur",
      type: "FOLLOW_UP" as const,
      sourceSentence: "Il faudrait relancer le fournisseur XYZ",
      dueDate: yesterday, // En retard !
      emailFrom: "procurement@company.com",
      emailReceivedAt: yesterday,
    },
  ];

  let created = 0;
  for (const actionData of actions) {
    await prisma.action.create({
      data: {
        userId: user.id,
        status: "TODO",
        ...actionData,
      },
    });
    created++;
  }

  console.log(`✅ Created ${created} test actions`);
  console.log(`   - 2 en retard`);
  console.log(`   - 1 urgente (< 24h)`);
  console.log(`   - 2 normales`);

  await prisma.$disconnect();
}

main();
