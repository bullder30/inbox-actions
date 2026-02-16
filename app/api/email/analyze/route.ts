import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { createEmailProvider } from "@/lib/email-provider/factory";
import { extractActionsFromEmail } from "@/lib/actions/extract-actions-regex";
import { prisma } from "@/lib/db";
import { sendActionDigest } from "@/lib/notifications/action-digest-service";
import { MAX_EMAILS_TO_ANALYZE } from "@/lib/config/sync";

export const dynamic = "force-dynamic";

/**
 * Helper pour obtenir l'identifiant du message selon le provider
 */
function getMessageId(email: { gmailMessageId?: string | null; imapUID?: bigint | null }): string | bigint {
  if (email.gmailMessageId) return email.gmailMessageId;
  if (email.imapUID) return email.imapUID;
  throw new Error("No message ID found");
}

/**
 * POST /api/email/analyze
 * Analyse les emails non traités et extrait les actions par REGEX
 * IMPORTANT: Ne stocke JAMAIS le corps complet des emails (RGPD)
 * Méthode : Regex déterministes uniquement, pas d'IA opaque
 */
export async function POST(req: NextRequest) {
  let emailProvider: Awaited<ReturnType<typeof createEmailProvider>> = null;

  try {
    // Vérification de l'authentification
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    // Créer le provider email (Gmail ou IMAP selon la config utilisateur)
    emailProvider = await createEmailProvider(session.user.id);

    if (!emailProvider) {
      return NextResponse.json(
        {
          error: "Email non connecté",
          message: "Veuillez connecter votre email pour analyser vos messages",
        },
        { status: 400 }
      );
    }

    // Récupérer les options
    const body = await req.json().catch(() => ({}));
    const maxEmails = body.maxEmails ?? MAX_EMAILS_TO_ANALYZE;

    // Récupérer les emails extraits (EXTRACTED) non encore analysés
    const extractedEmails = await emailProvider.getExtractedEmails();

    if (extractedEmails.length === 0) {
      return NextResponse.json({
        success: true,
        processedEmails: 0,
        extractedActions: 0,
        skippedEmails: 0,
        message: "Aucun email à analyser",
      });
    }

    // Limiter au nombre max configuré
    const emailsToProcess = extractedEmails.slice(0, maxEmails);

    console.log(`[Analyze] Processing ${emailsToProcess.length} email(s) out of ${extractedEmails.length} extracted`);

    let processedCount = 0;
    let extractedActionsCount = 0;
    let skippedCount = 0;

    // Traiter chaque email
    for (const emailMetadata of emailsToProcess) {
      try {
        const messageId = getMessageId(emailMetadata);
        const messageIdStr = typeof messageId === "bigint" ? messageId.toString() : messageId;

        // Récupérer le corps de l'email (temporaire, en mémoire uniquement)
        const body = await emailProvider.getEmailBodyForAnalysis(messageId);

        if (!body) {
          console.warn(`No body for email ${messageIdStr}, marking as analyzed anyway`);
          // Marquer comme analysé même si le body est vide
          await emailProvider.markEmailAsAnalyzed(messageId);
          processedCount++;
          continue;
        }

        // Extraire les actions avec REGEX (déterministe)
        const extractedActions = extractActionsFromEmail({
          from: emailMetadata.from,
          subject: emailMetadata.subject,
          body, // ⚠️ Utilisé UNIQUEMENT en mémoire, JAMAIS stocké
          receivedAt: emailMetadata.receivedAt,
        });

        // Stocker les actions extraites en base de données (s'il y en a)
        for (const action of extractedActions) {
          await prisma.action.create({
            data: {
              userId: session.user.id,
              title: action.title,
              type: action.type,
              sourceSentence: action.sourceSentence,
              emailFrom: emailMetadata.from,
              emailReceivedAt: emailMetadata.receivedAt,
              gmailMessageId: emailMetadata.gmailMessageId, // Pour lien Gmail (null si IMAP)
              imapUID: emailMetadata.imapUID, // Pour IMAP (null si Gmail)
              emailWebUrl: emailMetadata.webUrl, // URL vers l'email dans le webmail
              dueDate: action.dueDate,
              status: "TODO",
            },
          });

          extractedActionsCount++;
        }

        // Marquer l'email comme analysé (ANALYZED) - même si aucune action extraite
        await emailProvider.markEmailAsAnalyzed(messageId);
        processedCount++;
      } catch (error) {
        const messageIdStr = emailMetadata.gmailMessageId || emailMetadata.imapUID?.toString() || "unknown";
        console.error(
          `Error processing email ${messageIdStr}:`,
          error
        );
        skippedCount++;
        // Continuer avec les autres emails
      }
    }

    // Envoyer la notification si des actions ont été extraites
    if (extractedActionsCount > 0) {
      try {
        await sendActionDigest(session.user.id);
      } catch (notifError) {
        console.error("[Analyze] Error sending notification:", notifError);
      }
    }

    return NextResponse.json({
      success: true,
      processedEmails: processedCount,
      extractedActions: extractedActionsCount,
      skippedEmails: skippedCount,
      message: `${extractedActionsCount} action(s) extraite(s) depuis ${processedCount} email(s)`,
    });
  } catch (error) {
    console.error("Error analyzing emails:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'analyse des emails" },
      { status: 500 }
    );
  } finally {
    // Fermer la connexion email (IMAP) proprement
    if (emailProvider) {
      try {
        await emailProvider.disconnect();
      } catch (disconnectError) {
        console.warn("[Analyze] Error disconnecting:", disconnectError);
      }
    }
  }
}
