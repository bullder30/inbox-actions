#!/usr/bin/env tsx

/**
 * Script de migration : Analyser tous les emails EXTRACTED existants
 *
 * Ce script traite rétroactivement tous les emails qui sont en statut EXTRACTED
 * mais qui n'ont jamais été analysés (bug précédent où les emails sans actions
 * ne passaient jamais en ANALYZED).
 *
 * Usage: pnpm tsx scripts/migrate-analyze-extracted-emails.ts
 */

import { PrismaClient } from "@prisma/client";
import { createGmailService } from "@/lib/gmail/gmail-service";
import { extractActionsFromEmail } from "@/lib/actions/extract-actions-regex";

// Créer une instance Prisma pour le script
const prisma = new PrismaClient();

async function migrateExtractedEmails() {
  const startTime = Date.now();

  console.log("🚀 Début de la migration des emails EXTRACTED\n");

  try {
    // Récupérer tous les utilisateurs avec Gmail connecté
    const usersWithGmail = await prisma.account.findMany({
      where: {
        provider: "google",
        access_token: { not: null },
      },
      select: {
        userId: true,
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      distinct: ["userId"],
    });

    console.log(`📊 ${usersWithGmail.length} utilisateur(s) avec Gmail connecté\n`);

    // Stats globales
    const stats = {
      totalUsers: usersWithGmail.length,
      successUsers: 0,
      failedUsers: 0,
      totalEmailsProcessed: 0,
      totalActionsExtracted: 0,
      errors: [] as string[],
    };

    // Traiter chaque utilisateur
    for (const account of usersWithGmail) {
      const userId = account.userId;
      const userEmail = account.user.email || "unknown";

      try {
        console.log(`👤 Traitement de l'utilisateur: ${userEmail} (${userId})`);

        // Créer le service Gmail
        const gmailService = await createGmailService(userId);

        if (!gmailService) {
          console.warn(`⚠️  Gmail service indisponible pour ${userEmail}`);
          stats.failedUsers++;
          stats.errors.push(`${userEmail}: Gmail service unavailable`);
          continue;
        }

        // Récupérer TOUS les emails EXTRACTED (non encore analysés)
        const extractedEmails = await gmailService.getExtractedEmails();

        if (extractedEmails.length === 0) {
          console.log(`   ✅ Aucun email EXTRACTED à traiter\n`);
          stats.successUsers++;
          continue;
        }

        console.log(`   📧 ${extractedEmails.length} email(s) EXTRACTED à analyser`);

        let processedCount = 0;
        let actionsExtracted = 0;

        // Traiter chaque email
        for (const emailMetadata of extractedEmails) {
          try {
            // Récupérer le corps de l'email (temporaire, en mémoire uniquement)
            const body = await gmailService.getEmailBodyForAnalysis(
              emailMetadata.gmailMessageId
            );

            if (!body) {
              console.log(`   ⚠️  Pas de corps pour ${emailMetadata.gmailMessageId}, marqué ANALYZED quand même`);
              await gmailService.markEmailAsAnalyzed(emailMetadata.gmailMessageId);
              processedCount++;
              continue;
            }

            // Extraire les actions avec REGEX (déterministe)
            const extractedActions = extractActionsFromEmail({
              from: emailMetadata.from,
              subject: emailMetadata.subject,
              body,
              receivedAt: emailMetadata.receivedAt,
            });

            // Stocker les actions extraites (s'il y en a)
            for (const action of extractedActions) {
              await prisma.action.create({
                data: {
                  userId,
                  title: action.title,
                  type: action.type,
                  sourceSentence: action.sourceSentence,
                  emailFrom: emailMetadata.from,
                  emailReceivedAt: emailMetadata.receivedAt,
                  dueDate: action.dueDate,
                  status: "TODO",
                },
              });

              actionsExtracted++;
            }

            // Marquer l'email comme analysé (ANALYZED) - même si aucune action extraite
            await gmailService.markEmailAsAnalyzed(emailMetadata.gmailMessageId);
            processedCount++;

          } catch (emailError) {
            console.error(
              `   ❌ Erreur lors du traitement de l'email ${emailMetadata.gmailMessageId}:`,
              emailError
            );
            // Continuer avec les autres emails
          }
        }

        console.log(`   ✅ ${processedCount} email(s) traité(s), ${actionsExtracted} action(s) extraite(s)\n`);

        stats.totalEmailsProcessed += processedCount;
        stats.totalActionsExtracted += actionsExtracted;
        stats.successUsers++;

      } catch (userError) {
        console.error(`❌ Erreur pour l'utilisateur ${userEmail}:`, userError);
        stats.failedUsers++;
        stats.errors.push(
          `${userEmail}: ${userError instanceof Error ? userError.message : "Unknown error"}`
        );
      }
    }

    const duration = Date.now() - startTime;

    // Résumé final
    console.log("\n" + "=".repeat(60));
    console.log("✨ Migration terminée !");
    console.log("=".repeat(60));
    console.log(`⏱️  Durée: ${duration}ms`);
    console.log(`👥 Utilisateurs: ${stats.successUsers}/${stats.totalUsers} traités avec succès`);
    console.log(`📧 Emails analysés: ${stats.totalEmailsProcessed}`);
    console.log(`📋 Actions extraites: ${stats.totalActionsExtracted}`);

    if (stats.errors.length > 0) {
      console.log("\n⚠️  Erreurs rencontrées:");
      stats.errors.forEach((error) => console.log(`   - ${error}`));
    }

    console.log("\n");

  } catch (error) {
    console.error("❌ Erreur fatale lors de la migration:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Lancer la migration
migrateExtractedEmails();
