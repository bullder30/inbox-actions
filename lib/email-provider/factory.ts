/**
 * Factory pour créer le(s) provider(s) email selon la configuration utilisateur
 */

import { prisma } from "@/lib/db";
import { createIMAPService, createAllIMAPServices, createIMAPServiceById } from "@/lib/imap/imap-service";
import { createMicrosoftGraphServiceByMailbox } from "@/lib/microsoft-graph/graph-service";
import { IMAPProvider } from "./imap-provider";
import { MicrosoftGraphProvider } from "./microsoft-graph-provider";
import type { IEmailProvider } from "./interface";

/**
 * Crée toutes les instances de providers email actifs pour l'utilisateur.
 * Retourne un tableau (vide si aucun provider configuré).
 */
export async function createAllEmailProviders(
  userId: string
): Promise<IEmailProvider[]> {
  const providers: IEmailProvider[] = [];

  try {
    // --- IMAP providers (toutes les credentials connectées) ---
    const imapServices = await createAllIMAPServices(userId);

    if (imapServices.length > 0) {
      // Récupérer les labels des credentials IMAP en une seule requête
      const credentials = await prisma.iMAPCredential.findMany({
        where: { userId, isConnected: true },
        select: { id: true, label: true, imapUsername: true },
      });
      const labelMap = new Map(
        credentials.map((c) => [c.id, c.label || c.imapUsername])
      );

      for (const service of imapServices) {
        const label = labelMap.get(service.id) ?? null;
        providers.push(new IMAPProvider(service, service.id, label));
      }
    }

    // --- Microsoft Graph providers (toutes les boîtes actives) ---
    const graphMailboxes = await prisma.microsoftGraphMailbox.findMany({
      where: { userId, isActive: true },
      select: { id: true, label: true, email: true },
    });

    for (const mailbox of graphMailboxes) {
      const graphService = await createMicrosoftGraphServiceByMailbox(mailbox.id, userId);
      if (graphService) {
        const label = mailbox.label || mailbox.email || null;
        providers.push(new MicrosoftGraphProvider(graphService, userId, label));
      }
    }
  } catch (error) {
    console.error("[EmailProvider] Error creating all providers:", error);
  }

  return providers;
}

/**
 * Crée une instance du provider email pour l'utilisateur (premier disponible).
 * @deprecated Préférer createAllEmailProviders pour le support multi-boîtes
 */
export async function createEmailProvider(
  userId: string
): Promise<IEmailProvider | null> {
  try {
    // Chercher d'abord une credential IMAP connectée
    const imapService = await createIMAPService(userId);
    if (imapService) {
      const credential = await prisma.iMAPCredential.findFirst({
        where: { userId, isConnected: true },
        select: { id: true, label: true, imapUsername: true },
      });
      const label = credential?.label || credential?.imapUsername || null;
      return new IMAPProvider(imapService, imapService.id, label);
    }

    // Sinon Microsoft Graph (première boîte active)
    const firstGraphMailbox = await prisma.microsoftGraphMailbox.findFirst({
      where: { userId, isActive: true },
      select: { id: true, label: true, email: true },
    });
    if (firstGraphMailbox) {
      const graphService = await createMicrosoftGraphServiceByMailbox(firstGraphMailbox.id, userId);
      if (graphService) {
        const label = firstGraphMailbox.label || firstGraphMailbox.email || null;
        return new MicrosoftGraphProvider(graphService, userId, label);
      }
    }

    console.log("[EmailProvider] No email provider configured for user:", userId);
    return null;
  } catch (error) {
    console.error("[EmailProvider] Error creating provider:", error);
    return null;
  }
}

/**
 * Crée une instance IMAP provider par credential ID
 */
export async function createIMAPProviderById(
  credentialId: string,
  userId: string
): Promise<IMAPProvider | null> {
  const service = await createIMAPServiceById(credentialId, userId);
  if (!service) return null;

  const credential = await prisma.iMAPCredential.findUnique({
    where: { id: credentialId },
    select: { label: true, imapUsername: true },
  });
  const label = credential?.label || credential?.imapUsername || null;
  return new IMAPProvider(service, credentialId, label);
}

/**
 * Crée une instance Microsoft Graph provider pour la première boîte active
 */
export async function createMicrosoftGraphProvider(
  userId: string
): Promise<MicrosoftGraphProvider | null> {
  const mailbox = await prisma.microsoftGraphMailbox.findFirst({
    where: { userId, isActive: true },
    select: { id: true, label: true, email: true },
  });
  if (!mailbox) return null;

  const service = await createMicrosoftGraphServiceByMailbox(mailbox.id, userId);
  if (!service) return null;

  const label = mailbox.label || mailbox.email || null;
  return new MicrosoftGraphProvider(service, userId, label);
}
