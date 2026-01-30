/**
 * Service IMAP
 * Récupère les emails via IMAP de manière sécurisée
 * Alternative à Gmail API - fonctionne avec tous les providers IMAP
 */

import { ImapFlow } from "imapflow";
import { simpleParser, ParsedMail } from "mailparser";

import { prisma } from "@/lib/db";
import { decryptPassword } from "./imap-credentials";
import { getOAuthAccessToken } from "./oauth-token";
import type {
  IMAPConfig,
  FetchEmailsOptions,
  EmailMetadataType,
  IMAPStatus,
  IMAPFolder,
} from "./types";

// ============================================================================
// FONCTIONS UTILITAIRES
// ============================================================================

/**
 * Décode les entités HTML courantes en caractères normaux
 */
function decodeHtmlEntities(text: string): string {
  let result = text.replace(/&#(\d+);/g, (_, code) => {
    const charCode = parseInt(code, 10);
    return String.fromCharCode(charCode);
  });

  result = result.replace(/&#x([0-9a-fA-F]+);/g, (_, code) => {
    const charCode = parseInt(code, 16);
    return String.fromCharCode(charCode);
  });

  const namedEntities: { [key: string]: string } = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&apos;": "'",
    "&nbsp;": " ",
    "&ndash;": "–",
    "&mdash;": "—",
    "&lsquo;": "'",
    "&rsquo;": "'",
    "&ldquo;": '"',
    "&rdquo;": '"',
    "&hellip;": "…",
    "&euro;": "€",
    "&agrave;": "à",
    "&eacute;": "é",
    "&egrave;": "è",
    "&ccedil;": "ç",
  };

  for (const [entity, char] of Object.entries(namedEntities)) {
    result = result.replace(new RegExp(entity, "gi"), char);
  }

  return result;
}

/**
 * Normalise les apostrophes et guillemets typographiques
 */
function normalizeTypography(text: string): string {
  return text
    .replace(/\u2019/g, "'")
    .replace(/\u2018/g, "'")
    .replace(/\u02BC/g, "'")
    .replace(/`/g, "'")
    .replace(/[«»„""]/g, '"')
    .replace(/\u00A0/g, " ");
}

/**
 * Convertit HTML en texte brut
 */
function htmlToText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n\s*\n\s*\n/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/**
 * Extrait un snippet de 200 caractères max du texte
 */
function extractSnippet(text: string, maxLength: number = 200): string {
  const cleaned = text
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, maxLength);

  if (text.length > maxLength) {
    return cleaned + "...";
  }
  return cleaned;
}

/**
 * Extrait l'adresse email d'une chaîne "Nom <email@example.com>"
 */
function extractEmailAddress(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return match ? match[1] : from;
}

// ============================================================================
// CLASSE PRINCIPALE
// ============================================================================

/**
 * Classe IMAPService pour interagir avec un serveur IMAP
 */
export class IMAPService {
  private config: IMAPConfig;
  private userId: string;
  private credentialId: string;
  private client: ImapFlow | null = null;

  constructor(config: IMAPConfig, userId: string, credentialId: string) {
    this.config = config;
    this.userId = userId;
    this.credentialId = credentialId;
  }

  /**
   * Crée une connexion IMAP
   */
  private async connect(): Promise<ImapFlow> {
    console.log(`[IMAP] Connecting to ${this.config.host}:${this.config.port}`);
    console.log(`[IMAP] TLS: ${this.config.useTLS}, OAuth2: ${this.config.useOAuth2}, Provider: ${this.config.oauthProvider}`);

    if (this.client?.usable) {
      console.log(`[IMAP] Reusing existing connection`);
      return this.client;
    }

    // Determine authentication method
    let auth: { user: string; pass?: string; accessToken?: string };

    if (this.config.useOAuth2 && this.config.oauthProvider) {
      console.log(`[IMAP] Using OAuth2 XOAUTH2 authentication`);
      // Use OAuth2 XOAUTH2 authentication
      const accessToken = await getOAuthAccessToken(
        this.userId,
        this.config.oauthProvider
      );

      if (!accessToken) {
        const errorMsg = `Failed to get OAuth2 access token for ${this.config.oauthProvider}`;
        console.error(`[IMAP] ${errorMsg}`);
        throw new Error(errorMsg);
      }

      console.log(`[IMAP] Got OAuth2 token, length: ${accessToken.length}`);
      auth = {
        user: this.config.username,
        accessToken: accessToken,
      };
      console.log(`[IMAP] Auth configured for user: ${this.config.username}`);
    } else {
      console.log(`[IMAP] Using basic password authentication`);
      // Use basic authentication
      auth = {
        user: this.config.username,
        pass: this.config.password,
      };
    }

    console.log(`[IMAP] Creating ImapFlow client...`);
    this.client = new ImapFlow({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.useTLS !== false,
      auth,
      logger: {
        debug: (info) => console.log(`[IMAP DEBUG] ${JSON.stringify(info)}`),
        info: (info) => console.log(`[IMAP INFO] ${JSON.stringify(info)}`),
        warn: (info) => console.warn(`[IMAP WARN] ${JSON.stringify(info)}`),
        error: (info) => console.error(`[IMAP ERROR] ${JSON.stringify(info)}`),
      },
    });

    try {
      console.log(`[IMAP] Attempting to connect...`);
      await this.client.connect();
      console.log(`[IMAP] Connected successfully!`);

      // Mettre à jour le statut de connexion
      await prisma.iMAPCredential.update({
        where: { id: this.credentialId },
        data: {
          isConnected: true,
          connectionError: null,
          lastErrorAt: null,
        },
      });

      return this.client;
    } catch (error) {
      // Enregistrer l'erreur de connexion
      const errorMessage =
        error instanceof Error ? error.message : "Unknown connection error";

      console.error(`[IMAP] Connection failed: ${errorMessage}`);
      if (error instanceof Error && error.stack) {
        console.error(`[IMAP] Stack: ${error.stack}`);
      }

      await prisma.iMAPCredential.update({
        where: { id: this.credentialId },
        data: {
          isConnected: false,
          connectionError: errorMessage,
          lastErrorAt: new Date(),
        },
      });

      throw error;
    }
  }

  /**
   * Ferme la connexion IMAP
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.logout();
      this.client = null;
    }
  }

  /**
   * Teste la connexion IMAP
   */
  async testConnection(): Promise<boolean> {
    try {
      const client = await this.connect();
      await client.logout();
      this.client = null;
      return true;
    } catch (error) {
      console.error("[IMAP] Connection test failed:", error);
      return false;
    }
  }

  /**
   * Liste les dossiers IMAP disponibles
   */
  async getFolders(): Promise<IMAPFolder[]> {
    const client = await this.connect();
    const folders: IMAPFolder[] = [];

    try {
      const mailboxes = await client.list();

      for (const mailbox of mailboxes) {
        folders.push({
          name: mailbox.name,
          path: mailbox.path,
          flags: mailbox.flags ? Array.from(mailbox.flags) : [],
          delimiter: mailbox.delimiter || "/",
        });
      }

      return folders;
    } finally {
      await this.disconnect();
    }
  }

  /**
   * Récupère les nouveaux emails depuis le dernier sync
   * Stocke uniquement les métadonnées minimales (RGPD compliant)
   */
  async fetchNewEmails(
    options: FetchEmailsOptions = {}
  ): Promise<EmailMetadataType[]> {
    const { maxResults = 100, folder = this.config.folder || "INBOX" } = options;

    const client = await this.connect();
    const emailsMetadata: EmailMetadataType[] = [];

    try {
      // Récupérer le dernier UID synchronisé
      const credential = await prisma.iMAPCredential.findUnique({
        where: { id: this.credentialId },
        select: { lastUID: true, lastIMAPSync: true },
      });

      console.debug("[IMAP] Credential lastUID:", credential?.lastUID?.toString(), "lastSync:", credential?.lastIMAPSync);

      // Ouvrir le dossier
      const mailbox = await client.getMailboxLock(folder);

      try {
        // Déterminer la plage de UIDs à récupérer
        let searchCriteria: string;

        if (credential?.lastUID) {
          // Récupérer les emails depuis le dernier UID + 1
          const startUID = credential.lastUID + BigInt(1);
          searchCriteria = `${startUID}:*`;
        } else {
          // Première sync : récupérer les emails récents (dernières 24h)
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          // On utilise SINCE pour filtrer par date
          searchCriteria = "*";
        }

        // Rechercher les UIDs des messages
        const uidsResult = await client.search({ uid: searchCriteria }, { uid: true });

        // client.search peut retourner false si aucun résultat
        if (!uidsResult || uidsResult.length === 0) {
          console.debug("[IMAP] No new emails found");
          return [];
        }

        const uids = uidsResult as number[];

        // Limiter au nombre maximum demandé (les plus récents)
        const uidsToFetch = uids.slice(-maxResults);
        console.log(
          `[IMAP] Found ${uids.length} email(s), fetching ${uidsToFetch.length}`
        );

        let lastProcessedUID: bigint | null = null;

        console.log(`[IMAP] Processing emails for userId: ${this.userId}`);
        console.log(`[IMAP] UIDs to fetch:`, uidsToFetch);

        // Récupérer les métadonnées de chaque message
        // Note: Le 3ème paramètre { uid: true } indique qu'on utilise des UIDs (pas des sequence numbers)
        for await (const message of client.fetch(uidsToFetch, {
          envelope: true,
          internalDate: true,
          flags: true,
        }, { uid: true })) {
          const uid = BigInt(message.uid);
          console.log(`[IMAP] Processing UID: ${uid}`);

          // Vérifier si l'email existe déjà en base
          const existing = await prisma.emailMetadata.findUnique({
            where: {
              userId_imapUID: {
                userId: this.userId,
                imapUID: uid,
              },
            },
          });

          if (existing) {
            console.log(`[IMAP] UID ${uid} already exists for userId ${this.userId}, skipping`);
            continue;
          }

          // Extraire les métadonnées
          const envelope = message.envelope;
          if (!envelope) {
            console.log(`[IMAP] UID ${uid} has no envelope, skipping`);
            continue;
          }

          const from = envelope.from?.[0]
            ? `${envelope.from[0].name || ""} <${envelope.from[0].address || ""}>`
            : "Unknown";

          const subject = envelope.subject || null;
          const messageId = envelope.messageId || null;
          const internalDate = message.internalDate;
          const receivedAt = internalDate
            ? (typeof internalDate === "string" ? new Date(internalDate) : internalDate)
            : new Date();

          // Pour le snippet, on récupère juste les headers pour l'instant
          // Le snippet sera généré lors de l'analyse si besoin
          const snippet = subject ? extractSnippet(subject, 200) : "";

          // Extraire les labels/flags
          const labels = message.flags ? Array.from(message.flags) : [];

          const metadata: EmailMetadataType = {
            imapUID: uid,
            imapMessageId: messageId,
            gmailMessageId: null,
            gmailThreadId: null,
            from: normalizeTypography(decodeHtmlEntities(from)),
            subject: subject
              ? normalizeTypography(decodeHtmlEntities(subject))
              : null,
            snippet: normalizeTypography(decodeHtmlEntities(snippet)),
            receivedAt,
            labels,
            emailProvider: "IMAP",
          };

          emailsMetadata.push(metadata);

          // Stocker en base de données
          try {
            await prisma.emailMetadata.create({
              data: {
                userId: this.userId,
                emailProvider: "IMAP",
                imapUID: uid,
                imapMessageId: messageId,
                from: metadata.from,
                subject: metadata.subject,
                snippet: metadata.snippet,
                receivedAt: metadata.receivedAt,
                labels: metadata.labels,
              },
            });
            console.log(`[IMAP] UID ${uid} saved to database for userId ${this.userId}`);
          } catch (createError) {
            console.error(`[IMAP] Failed to save UID ${uid}:`, createError);
            // Remove from metadata array since it wasn't saved
            emailsMetadata.pop();
            continue;
          }

          lastProcessedUID = uid;
        }

        // Mettre à jour le dernier UID synchronisé
        if (lastProcessedUID) {
          await prisma.iMAPCredential.update({
            where: { id: this.credentialId },
            data: {
              lastUID: lastProcessedUID,
              lastIMAPSync: new Date(),
            },
          });
        }

        // Mettre à jour le user
        await prisma.user.update({
          where: { id: this.userId },
          data: {
            lastGmailSync: new Date(), // Réutilisé pour IMAP aussi
          },
        });

        return emailsMetadata;
      } finally {
        mailbox.release();
      }
    } catch (error) {
      console.error("[IMAP] Error fetching emails:", error);
      throw new Error(
        `Erreur lors de la récupération des emails: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      await this.disconnect();
    }
  }

  /**
   * Récupère le corps d'un email pour analyse (usage temporaire uniquement)
   * IMPORTANT: Ne jamais stocker le résultat en base de données
   */
  async getEmailBodyForAnalysis(imapUID: bigint): Promise<string | null> {
    const client = await this.connect();
    const folder = this.config.folder || "INBOX";

    try {
      const mailbox = await client.getMailboxLock(folder);

      try {
        // Récupérer le message complet
        const message = await client.fetchOne(
          imapUID.toString(),
          { source: true },
          { uid: true }
        );

        // fetchOne peut retourner false si le message n'existe pas
        if (!message || !("source" in message) || !message.source) {
          return null;
        }

        // Parser le message avec mailparser
        const parsed = await simpleParser(message.source);

        // Extraire le texte
        let body = "";

        if (parsed.text) {
          body = parsed.text;
        } else if (parsed.html) {
          body = htmlToText(parsed.html);
        }

        // Normaliser le texte
        body = normalizeTypography(decodeHtmlEntities(body));

        return body;
      } finally {
        mailbox.release();
      }
    } catch (error) {
      console.error(`[IMAP] Error fetching email body for UID ${imapUID}:`, error);
      return null;
    } finally {
      await this.disconnect();
    }
  }

  /**
   * Récupère les emails extraits (EXTRACTED) qui n'ont pas encore été analysés
   */
  async getExtractedEmails(): Promise<EmailMetadataType[]> {
    const emails = await prisma.emailMetadata.findMany({
      where: {
        userId: this.userId,
        emailProvider: "IMAP",
        status: "EXTRACTED",
      },
      orderBy: {
        receivedAt: "desc",
      },
    });

    return emails.map((email) => ({
      imapUID: email.imapUID,
      imapMessageId: email.imapMessageId,
      gmailMessageId: email.gmailMessageId,
      gmailThreadId: email.gmailThreadId,
      from: email.from,
      subject: email.subject,
      snippet: email.snippet,
      receivedAt: email.receivedAt,
      labels: email.labels,
      emailProvider: "IMAP",
    }));
  }

  /**
   * Marque un email comme analysé (ANALYZED)
   */
  async markEmailAsAnalyzed(imapUID: bigint): Promise<void> {
    await prisma.emailMetadata.update({
      where: {
        userId_imapUID: {
          userId: this.userId,
          imapUID,
        },
      },
      data: {
        status: "ANALYZED",
      },
    });
  }

  /**
   * Compte le nombre de nouveaux emails non synchronisés
   */
  async countNewEmailsInImap(): Promise<number> {
    const client = await this.connect();
    const folder = this.config.folder || "INBOX";

    try {
      const mailbox = await client.getMailboxLock(folder);

      try {
        // Récupérer le dernier UID synchronisé
        const credential = await prisma.iMAPCredential.findUnique({
          where: { id: this.credentialId },
          select: { lastUID: true },
        });

        if (!credential?.lastUID) {
          // Première sync : compter tous les emails récents
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);

          const uidsResult = await client.search(
            { since: yesterday },
            { uid: true }
          );
          // client.search peut retourner false si aucun résultat
          return uidsResult ? (uidsResult as number[]).length : 0;
        }

        // Compter les emails depuis le dernier UID
        const startUID = credential.lastUID + BigInt(1);
        const uidsResult = await client.search(
          { uid: `${startUID}:*` },
          { uid: true }
        );

        // client.search peut retourner false si aucun résultat
        return uidsResult ? (uidsResult as number[]).length : 0;
      } finally {
        mailbox.release();
      }
    } catch (error) {
      console.error("[IMAP] Error counting new emails:", error);
      return 0;
    } finally {
      await this.disconnect();
    }
  }

  /**
   * Récupère le statut de la connexion IMAP
   */
  async getStatus(): Promise<IMAPStatus> {
    const credential = await prisma.iMAPCredential.findUnique({
      where: { id: this.credentialId },
      select: {
        isConnected: true,
        lastIMAPSync: true,
        connectionError: true,
        lastErrorAt: true,
      },
    });

    if (!credential) {
      return {
        isConnected: false,
        lastSync: null,
        lastError: "Credential not found",
        lastErrorAt: null,
      };
    }

    return {
      isConnected: credential.isConnected,
      lastSync: credential.lastIMAPSync,
      lastError: credential.connectionError,
      lastErrorAt: credential.lastErrorAt,
    };
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Factory function pour créer une instance de IMAPService
 * Récupère automatiquement les credentials depuis la base de données
 */
export async function createIMAPService(
  userId: string
): Promise<IMAPService | null> {
  try {
    console.debug("[IMAP] Creating service for userId:", userId);

    // Récupérer les credentials IMAP de l'utilisateur
    const credential = await prisma.iMAPCredential.findFirst({
      where: { userId },
      select: {
        id: true,
        imapHost: true,
        imapPort: true,
        imapUsername: true,
        imapPassword: true,
        imapFolder: true,
        useTLS: true,
        useOAuth2: true,
        oauthProvider: true,
      },
    });

    if (!credential) {
      console.debug("[IMAP] No IMAP credential found for user:", userId);
      return null;
    }

    console.debug("[IMAP] Found credential:", credential.id, "for host:", credential.imapHost);

    // Déchiffrer le mot de passe (sauf si OAuth2)
    let password: string = "";
    if (!credential.useOAuth2) {
      try {
        password = decryptPassword(credential.imapPassword);
      } catch (error) {
        console.error("[IMAP] Failed to decrypt password for user:", userId);
        return null;
      }
    }

    const config: IMAPConfig = {
      host: credential.imapHost,
      port: credential.imapPort,
      username: credential.imapUsername,
      password,
      folder: credential.imapFolder,
      useTLS: credential.useTLS,
      useOAuth2: credential.useOAuth2,
      oauthProvider: credential.oauthProvider || undefined,
    };

    return new IMAPService(config, userId, credential.id);
  } catch (error) {
    console.error("[IMAP] Error creating IMAP service:", error);
    return null;
  }
}
