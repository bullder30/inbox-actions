/**
 * Service Gmail API
 * Récupère les emails Gmail en lecture seule de manière sécurisée
 */

import { google, gmail_v1 } from "googleapis";
import { prisma } from "@/lib/db";

/**
 * Type pour les métadonnées d'email minimales (RGPD compliant)
 */
export type EmailMetadataType = {
  gmailMessageId: string;
  gmailThreadId: string;
  from: string;
  subject: string | null;
  snippet: string;
  receivedAt: Date;
  labels: string[];
};

/**
 * Options pour la récupération des emails
 */
export type FetchEmailsOptions = {
  maxResults?: number; // Nombre maximum d'emails à récupérer (si non fourni: récupère tous les emails avec pagination)
  query?: string; // Query Gmail (ex: "is:unread")
  labelIds?: string[]; // Filter par labels (ex: ["INBOX"])
};

/**
 * Classe GmailService pour interagir avec Gmail API
 */
export class GmailService {
  private gmail: gmail_v1.Gmail;
  private userId: string;

  constructor(accessToken: string, userId: string) {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: accessToken,
    });

    this.gmail = google.gmail({
      version: "v1",
      auth: oauth2Client,
    });

    this.userId = userId;
  }

  /**
   * Récupère les emails depuis le dernier scan
   * Stocke uniquement les métadonnées minimales (RGPD compliant)
   *
   * Stratégie d'extraction :
   * - Si lastGmailSync existe : récupère tous les emails depuis cette date
   * - Si première synchro (pas de lastGmailSync) : récupère les emails des dernières 24h
   * - Si maxResults n'est pas fourni : récupère TOUS les emails disponibles avec pagination
   */
  async fetchNewEmails(
    options: FetchEmailsOptions = {}
  ): Promise<EmailMetadataType[]> {
    const { maxResults, query, labelIds = ["INBOX"] } = options;

    try {
      // Récupérer le dernier historyId pour optimisation future
      const user = await prisma.user.findUnique({
        where: { id: this.userId },
        select: { lastGmailSync: true, gmailHistoryId: true },
      });

      // Déterminer le point de départ pour l'extraction
      let afterTimestamp: number;

      if (user?.lastGmailSync) {
        // Synchro existante : récupérer tous les emails depuis la dernière synchro
        afterTimestamp = Math.floor(user.lastGmailSync.getTime() / 1000);
        console.log(`[Gmail] Fetching emails since last sync: ${user.lastGmailSync.toISOString()}`);
      } else {
        // Première synchro : récupérer uniquement les dernières 24h
        const last24Hours = new Date();
        last24Hours.setHours(last24Hours.getHours() - 24);
        afterTimestamp = Math.floor(last24Hours.getTime() / 1000);
        console.log(`[Gmail] First sync: fetching emails from last 24 hours`);
      }

      // Construire la query Gmail : filtrer par date + query utilisateur si fournie
      const gmailQuery = query
        ? `after:${afterTimestamp} ${query}`
        : `after:${afterTimestamp}`;

      // 1. Lister les IDs des messages avec pagination si nécessaire
      let allMessages: gmail_v1.Schema$Message[] = [];
      let pageToken: string | undefined = undefined;
      let lastResponse: gmail_v1.Schema$ListMessagesResponse | undefined;

      // Si maxResults est fourni, on fait une seule requête
      // Sinon, on pagine pour tout récupérer
      const shouldPaginate = maxResults === undefined;
      const pageSize = maxResults || 500; // Gmail API max = 500

      do {
        const listResponse = await this.gmail.users.messages.list({
          userId: "me",
          maxResults: pageSize,
          q: gmailQuery,
          labelIds,
          pageToken,
        });

        lastResponse = listResponse.data;
        const messages = listResponse.data.messages || [];
        allMessages = allMessages.concat(messages);

        // Si on ne pagine pas, on s'arrête après la première requête
        if (!shouldPaginate) break;

        // Continuer la pagination s'il y a un nextPageToken
        pageToken = listResponse.data.nextPageToken || undefined;
      } while (pageToken);

      if (allMessages.length === 0) {
        console.log("[Gmail] No new emails found");
        return [];
      }

      console.log(`[Gmail] Found ${allMessages.length} new email(s) to process`);

      // 2. Récupérer les métadonnées de chaque message (en batch si possible)
      const emailsMetadata: EmailMetadataType[] = [];

      for (const message of allMessages) {
        if (!message.id) continue;

        // Vérifier si l'email existe déjà en base
        const existing = await prisma.emailMetadata.findUnique({
          where: {
            userId_gmailMessageId: {
              userId: this.userId,
              gmailMessageId: message.id,
            },
          },
        });

        if (existing) {
          // Email déjà en base, skip
          continue;
        }

        // Récupérer les métadonnées UNIQUEMENT (pas le corps complet)
        const messageData = await this.gmail.users.messages.get({
          userId: "me",
          id: message.id,
          format: "metadata", // IMPORTANT: metadata only, pas le corps complet
          metadataHeaders: ["From", "Subject", "Date"], // Headers nécessaires
        });

        const metadata = this.extractMetadata(messageData.data);
        if (metadata) {
          emailsMetadata.push(metadata);

          // Stocker en base de données
          await prisma.emailMetadata.create({
            data: {
              userId: this.userId,
              gmailMessageId: metadata.gmailMessageId,
              gmailThreadId: metadata.gmailThreadId,
              from: metadata.from,
              subject: metadata.subject,
              snippet: metadata.snippet,
              receivedAt: metadata.receivedAt,
              labels: metadata.labels,
            },
          });
        }
      }

      // 3. Mettre à jour le timestamp du dernier sync
      await prisma.user.update({
        where: { id: this.userId },
        data: {
          lastGmailSync: new Date(),
          // Optionnel: stocker historyId pour sync incrémental futur
          gmailHistoryId: lastResponse?.resultSizeEstimate?.toString(),
        },
      });

      return emailsMetadata;
    } catch (error) {
      console.error("Error fetching Gmail emails:", error);
      throw new Error(
        `Erreur lors de la récupération des emails: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Extrait les métadonnées minimales d'un message Gmail
   */
  private extractMetadata(
    message: gmail_v1.Schema$Message
  ): EmailMetadataType | null {
    if (!message.id || !message.threadId) {
      return null;
    }

    // Extraire les headers
    const headers = message.payload?.headers || [];
    const getHeader = (name: string) => {
      const header = headers.find(
        (h) => h.name?.toLowerCase() === name.toLowerCase()
      );
      return header?.value || null;
    };

    const from = getHeader("From");
    const subject = getHeader("Subject");
    const dateStr = getHeader("Date");

    if (!from) {
      return null; // On ne peut pas identifier l'expéditeur, skip
    }

    // Parser la date
    const receivedAt = dateStr ? new Date(dateStr) : new Date();

    // Snippet (extrait court fourni par Gmail, max 200 caractères)
    const snippet = message.snippet || "";

    // Labels Gmail
    const labels = message.labelIds || [];

    return {
      gmailMessageId: message.id,
      gmailThreadId: message.threadId,
      from,
      subject,
      snippet,
      receivedAt,
      labels,
    };
  }

  /**
   * Récupère un email spécifique par son ID Gmail
   * Retourne uniquement les métadonnées (pas le corps complet)
   */
  async getEmailById(gmailMessageId: string): Promise<EmailMetadataType | null> {
    try {
      const messageData = await this.gmail.users.messages.get({
        userId: "me",
        id: gmailMessageId,
        format: "metadata",
        metadataHeaders: ["From", "Subject", "Date"],
      });

      return this.extractMetadata(messageData.data);
    } catch (error) {
      console.error(`Error fetching email ${gmailMessageId}:`, error);
      return null;
    }
  }

  /**
   * Récupère le corps d'un email pour analyse IA (usage temporaire uniquement)
   * IMPORTANT: Ne jamais stocker le résultat en base de données
   * Usage: Analyse temps réel pour extraction d'actions
   */
  async getEmailBodyForAnalysis(gmailMessageId: string): Promise<string | null> {
    try {
      const messageData = await this.gmail.users.messages.get({
        userId: "me",
        id: gmailMessageId,
        format: "full", // Full pour accéder au corps
      });

      // Extraire le texte du corps
      const body = this.extractBody(messageData.data);

      // ⚠️ AVERTISSEMENT: Ne JAMAIS stocker ce résultat en base
      // Usage temporaire uniquement pour analyse IA en mémoire

      return body;
    } catch (error) {
      console.error(`Error fetching email body ${gmailMessageId}:`, error);
      return null;
    }
  }

  /**
   * Extrait le corps textuel d'un message Gmail
   */
  private extractBody(message: gmail_v1.Schema$Message): string {
    const payload = message.payload;
    if (!payload) return "";

    // Fonction récursive pour extraire le texte des parties
    const extractFromParts = (parts: gmail_v1.Schema$MessagePart[]): string => {
      let text = "";

      for (const part of parts) {
        if (part.mimeType === "text/plain" && part.body?.data) {
          // Décoder le corps en base64
          const decoded = Buffer.from(part.body.data, "base64").toString("utf-8");
          text += decoded + "\n";
        } else if (part.parts) {
          // Récursion si multipart
          text += extractFromParts(part.parts);
        }
      }

      return text;
    };

    // Si le corps est directement dans payload.body
    if (payload.body?.data) {
      return Buffer.from(payload.body.data, "base64").toString("utf-8");
    }

    // Sinon, extraire des parties
    if (payload.parts) {
      return extractFromParts(payload.parts);
    }

    return "";
  }

  /**
   * Récupère les emails extraits (EXTRACTED) qui n'ont pas encore été analysés
   */
  async getExtractedEmails(): Promise<EmailMetadataType[]> {
    const emails = await prisma.emailMetadata.findMany({
      where: {
        userId: this.userId,
        status: "EXTRACTED",
      },
      orderBy: {
        receivedAt: "desc",
      },
    });

    return emails.map((email) => ({
      gmailMessageId: email.gmailMessageId,
      gmailThreadId: email.gmailThreadId,
      from: email.from,
      subject: email.subject,
      snippet: email.snippet,
      receivedAt: email.receivedAt,
      labels: email.labels,
    }));
  }

  /**
   * Marque un email comme analysé (ANALYZED)
   */
  async markEmailAsAnalyzed(gmailMessageId: string): Promise<void> {
    await prisma.emailMetadata.update({
      where: {
        userId_gmailMessageId: {
          userId: this.userId,
          gmailMessageId,
        },
      },
      data: {
        status: "ANALYZED",
      },
    });
  }

  /**
   * Compte le nombre de nouveaux emails dans Gmail qui ne sont pas encore synchronisés
   * Retourne le nombre d'emails disponibles depuis la dernière synchro
   *
   * Stratégie :
   * - Si lastGmailSync existe : compte les emails depuis cette date
   * - Si première synchro : compte les emails des dernières 24h
   */
  async countNewEmailsInGmail(): Promise<number> {
    try {
      // Récupérer la dernière date de synchro
      const user = await prisma.user.findUnique({
        where: { id: this.userId },
        select: { lastGmailSync: true },
      });

      // Déterminer le point de départ (même logique que fetchNewEmails)
      let afterTimestamp: number;

      if (user?.lastGmailSync) {
        // Synchro existante : compter depuis la dernière synchro
        afterTimestamp = Math.floor(user.lastGmailSync.getTime() / 1000);
      } else {
        // Première synchro : compter depuis les dernières 24h
        const last24Hours = new Date();
        last24Hours.setHours(last24Hours.getHours() - 24);
        afterTimestamp = Math.floor(last24Hours.getTime() / 1000);
      }

      // Query Gmail avec filtre de date
      const gmailQuery = `after:${afterTimestamp}`;

      // Récupérer la liste des IDs des messages dans INBOX depuis la date
      const listResponse = await this.gmail.users.messages.list({
        userId: "me",
        labelIds: ["INBOX"],
        q: gmailQuery,
        maxResults: 500, // Limiter pour éviter les timeouts
      });

      const gmailMessageIds = (listResponse.data.messages || [])
        .map((msg) => msg.id)
        .filter((id): id is string => id !== undefined);

      if (gmailMessageIds.length === 0) {
        return 0;
      }

      // Compter combien de ces IDs sont déjà en base
      const syncedCount = await prisma.emailMetadata.count({
        where: {
          userId: this.userId,
          gmailMessageId: {
            in: gmailMessageIds,
          },
        },
      });

      // Nouveaux emails = Total dans Gmail (depuis lastGmailSync) - Déjà synchronisés
      return gmailMessageIds.length - syncedCount;
    } catch (error) {
      console.error("Error counting new emails in Gmail:", error);
      return 0;
    }
  }
}

/**
 * Rafraîchit le token d'accès Google en utilisant le refresh token
 */
async function refreshGoogleToken(
  refreshToken: string,
  accountId: string
): Promise<string | null> {
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      console.error("Failed to refresh token:", await response.text());
      return null;
    }

    const data = await response.json();

    // Mettre à jour le token en base de données
    await prisma.account.update({
      where: { id: accountId },
      data: {
        access_token: data.access_token,
        expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
      },
    });

    return data.access_token;
  } catch (error) {
    console.error("Error refreshing token:", error);
    return null;
  }
}

/**
 * Factory function pour créer une instance de GmailService
 * Récupère automatiquement le token d'accès depuis la base de données
 * Rafraîchit automatiquement le token s'il est expiré
 */
export async function createGmailService(
  userId: string
): Promise<GmailService | null> {
  try {
    // Récupérer le compte Google de l'utilisateur
    const account = await prisma.account.findFirst({
      where: {
        userId,
        provider: "google",
      },
      select: {
        id: true,
        access_token: true,
        refresh_token: true,
        expires_at: true,
      },
    });

    if (!account || !account.access_token) {
      return null; // Utilisateur n'a pas connecté Gmail
    }

    let accessToken = account.access_token;

    // Vérifier si le token est expiré
    const now = Math.floor(Date.now() / 1000);
    if (account.expires_at && account.expires_at < now) {
      // Token expiré, essayer de le rafraîchir
      if (account.refresh_token) {
        console.log("Access token expired, refreshing...");
        const newToken = await refreshGoogleToken(
          account.refresh_token,
          account.id
        );

        if (newToken) {
          accessToken = newToken;
          console.log("Token refreshed successfully");
        } else {
          console.error("Failed to refresh token");
          return null; // Échec du rafraîchissement
        }
      } else {
        console.error("No refresh token available");
        return null; // Pas de refresh token
      }
    }

    return new GmailService(accessToken, userId);
  } catch (error) {
    console.error("Error creating Gmail service:", error);
    return null;
  }
}
