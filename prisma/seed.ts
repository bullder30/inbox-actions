import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Créer un utilisateur de test
  const testUser = await prisma.user.upsert({
    where: { email: "test@inbox-actions.com" },
    update: {},
    create: {
      email: "test@inbox-actions.com",
      name: "Test User",
      role: "USER",
    },
  });

  console.log("✅ Test user created:", testUser.email);

  // Créer des actions de test
  const actions = await Promise.all([
    prisma.action.create({
      data: {
        userId: testUser.id,
        title: "Envoyer le rapport Q4",
        type: "SEND",
        status: "TODO",
        sourceSentence:
          "Pourrais-tu m'envoyer le rapport du Q4 avant vendredi ?",
        emailFrom: "boss@company.com",
        emailReceivedAt: new Date("2024-01-15T09:30:00Z"),
        dueDate: new Date("2024-01-19T17:00:00Z"),
      },
    }),
    prisma.action.create({
      data: {
        userId: testUser.id,
        title: "Appeler le client ABC",
        type: "CALL",
        status: "TODO",
        sourceSentence:
          "Il faudrait appeler le client ABC pour faire le point sur le projet.",
        emailFrom: "sales@company.com",
        emailReceivedAt: new Date("2024-01-16T14:20:00Z"),
        dueDate: new Date("2024-01-18T16:00:00Z"),
      },
    }),
    prisma.action.create({
      data: {
        userId: testUser.id,
        title: "Relancer le fournisseur XYZ",
        type: "FOLLOW_UP",
        status: "DONE",
        sourceSentence: "Peux-tu relancer le fournisseur XYZ pour la facture ?",
        emailFrom: "accounting@company.com",
        emailReceivedAt: new Date("2024-01-10T11:15:00Z"),
        dueDate: new Date("2024-01-15T12:00:00Z"),
      },
    }),
    prisma.action.create({
      data: {
        userId: testUser.id,
        title: "Payer la facture #12345",
        type: "PAY",
        status: "TODO",
        sourceSentence:
          "Merci de procéder au paiement de la facture #12345 d'un montant de 2,500€.",
        emailFrom: "invoices@supplier.com",
        emailReceivedAt: new Date("2024-01-17T08:45:00Z"),
        dueDate: new Date("2024-01-25T23:59:00Z"),
      },
    }),
    prisma.action.create({
      data: {
        userId: testUser.id,
        title: "Valider le design de la landing page",
        type: "VALIDATE",
        status: "TODO",
        sourceSentence:
          "J'ai besoin de ta validation sur le nouveau design de la landing page.",
        emailFrom: "designer@agency.com",
        emailReceivedAt: new Date("2024-01-16T16:30:00Z"),
        dueDate: new Date("2024-01-20T10:00:00Z"),
      },
    }),
    prisma.action.create({
      data: {
        userId: testUser.id,
        title: "Envoyer les documents signés",
        type: "SEND",
        status: "IGNORED",
        sourceSentence: "N'oublie pas de m'envoyer les documents signés.",
        emailFrom: "legal@partner.com",
        emailReceivedAt: new Date("2024-01-12T13:00:00Z"),
      },
    }),
  ]);

  console.log(`✅ Created ${actions.length} test actions`);

  // Afficher un résumé
  const summary = await prisma.action.groupBy({
    by: ["status"],
    _count: true,
  });

  console.log("\n📊 Actions summary:");
  summary.forEach((item) => {
    console.log(`  - ${item.status}: ${item._count} actions`);
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("\n✅ Seeding completed successfully!");
  })
  .catch(async (e) => {
    console.error("\n❌ Seeding failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
