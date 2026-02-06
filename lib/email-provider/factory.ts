/**
 * Factory pour créer le bon provider email selon la configuration utilisateur
 */

import { prisma } from "@/lib/db";
import { createIMAPService } from "@/lib/imap/imap-service";
import { createMicrosoftGraphService } from "@/lib/microsoft-graph/graph-service";
import { IMAPProvider } from "./imap-provider";
import { MicrosoftGraphProvider } from "./microsoft-graph-provider";
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

    if (provider === "MICROSOFT_GRAPH") {
      // Créer le service Microsoft Graph
      const graphService = await createMicrosoftGraphService(userId);
      if (!graphService) {
        console.log("[EmailProvider] Failed to create Microsoft Graph service for user:", userId);
        return null;
      }
      return new MicrosoftGraphProvider(graphService, userId);
    }

    if (provider === "IMAP") {
      // Créer le service IMAP
      const imapService = await createIMAPService(userId);
      if (!imapService) {
        console.log("[EmailProvider] Failed to create IMAP service for user:", userId);
        return null;
      }
      return new IMAPProvider(imapService);
    }

    // GMAIL provider is deprecated - users should configure IMAP instead
    if (provider === "GMAIL") {
      console.log("[EmailProvider] Gmail API is deprecated. User should configure IMAP instead.");
      // Try IMAP as fallback
      const imapService = await createIMAPService(userId);
      if (imapService) {
        return new IMAPProvider(imapService);
      }
      return null;
    }

    // No provider configured
    console.log("[EmailProvider] No email provider configured for user:", userId);
    return null;
  } catch (error) {
    console.error("[EmailProvider] Error creating provider:", error);
    return null;
  }
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

/**
 * Crée une instance Microsoft Graph provider explicitement
 * Utile quand on sait qu'on veut Graph API spécifiquement
 */
export async function createMicrosoftGraphProvider(
  userId: string
): Promise<MicrosoftGraphProvider | null> {
  const service = await createMicrosoftGraphService(userId);
  if (!service) return null;
  return new MicrosoftGraphProvider(service, userId);
}
