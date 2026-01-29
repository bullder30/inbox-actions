/**
 * Factory pour créer le bon provider email selon la configuration utilisateur
 */

import { prisma } from "@/lib/db";
import { createGmailService } from "@/lib/gmail/gmail-service";
import { createIMAPService } from "@/lib/imap/imap-service";
import { GmailProvider } from "./gmail-provider";
import { IMAPProvider } from "./imap-provider";
import type { IEmailProvider } from "./interface";

/**
 * Crée une instance du provider email approprié pour l'utilisateur
 * Retourne null si aucun provider n'est configuré
 *
 * @param userId - L'ID de l'utilisateur
 * @returns Le provider email ou null
 */
export async function createEmailProvider(
  userId: string
): Promise<IEmailProvider | null> {
  try {
    console.debug("[EmailProvider] Creating provider for userId:", userId);

    // Récupérer la préférence de l'utilisateur
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { emailProvider: true, email: true },
    });

    if (!user) {
      console.log("[EmailProvider] User not found:", userId);
      return null;
    }

    const provider = user.emailProvider;
    console.debug("[EmailProvider] User", user.email, "has provider:", provider);

    if (provider === "IMAP") {
      // Créer le service IMAP
      const imapService = await createIMAPService(userId);
      if (!imapService) {
        console.log("[EmailProvider] Failed to create IMAP service for user:", userId);
        return null;
      }
      return new IMAPProvider(imapService);
    }

    // Par défaut : Gmail
    const gmailService = await createGmailService(userId);
    if (!gmailService) {
      console.log("[EmailProvider] Failed to create Gmail service for user:", userId);
      return null;
    }
    return new GmailProvider(gmailService);
  } catch (error) {
    console.error("[EmailProvider] Error creating provider:", error);
    return null;
  }
}

/**
 * Crée une instance Gmail provider explicitement
 * Utile quand on sait qu'on veut Gmail spécifiquement
 */
export async function createGmailProvider(
  userId: string
): Promise<GmailProvider | null> {
  const service = await createGmailService(userId);
  if (!service) return null;
  return new GmailProvider(service);
}

/**
 * Crée une instance IMAP provider explicitement
 * Utile quand on sait qu'on veut IMAP spécifiquement
 */
export async function createIMAPProvider(
  userId: string
): Promise<IMAPProvider | null> {
  const service = await createIMAPService(userId);
  if (!service) return null;
  return new IMAPProvider(service);
}
