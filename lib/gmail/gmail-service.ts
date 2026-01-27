/**
 * Service Gmail API
 * Récupère les emails Gmail en lecture seule de manière sécurisée
 */

import { gmail_v1, google } from "googleapis";

import { prisma } from "@/lib/db";

// ============================================================================
// FONCTIONS UTILITAIRES D'ENCODAGE
// ============================================================================

/**
 * Décode une chaîne encodée en quoted-printable
 * Convertit les séquences =XX en caractères UTF-8
 * Exemple: "l=E2=80=99=C3=A9ch=C3=A9ancier" → "l'échéancier"
 */
function decodeQuotedPrintable(text: string): string {
  // Remplacer les soft line breaks (=\r\n ou =\n)
  let decoded = text.replace(/=\r?\n/g, "");

  // Collecter tous les bytes encodés et décoder en UTF-8
  const bytes: number[] = [];
  let result = "";
  let i = 0;

  while (i < decoded.length) {
    if (decoded[i] === "=" && i + 2 < decoded.length) {
      const hex = decoded.substring(i + 1, i + 3);
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        bytes.push(parseInt(hex, 16));
        i += 3;
        continue;
      }
    }

    // Si on a des bytes accumulés, les décoder en UTF-8
    if (bytes.length > 0) {
      try {
        result += Buffer.from(bytes).toString("utf-8");
      } catch {
        // En cas d'erreur, garder les bytes bruts
        result += bytes.map((b) => String.fromCharCode(b)).join("");
      }
      bytes.length = 0;
    }

    result += decoded[i];
    i++;
  }

  // Décoder les bytes restants
  if (bytes.length > 0) {
    try {
      result += Buffer.from(bytes).toString("utf-8");
    } catch {
      result += bytes.map((b) => String.fromCharCode(b)).join("");
    }
  }

  return result;
}

/**
 * Décode les entités HTML courantes en caractères normaux
 * Gère les entités numériques (&#39;, &#x27;) et nommées (&amp;, &quot;, etc.)
 */
function decodeHtmlEntities(text: string): string {
  // Décoder les entités numériques décimales (&#39; → ')
  let result = text.replace(/&#(\d+);/g, (_, code) => {
    const charCode = parseInt(code, 10);
    return String.fromCharCode(charCode);
  });

  // Décoder les entités numériques hexadécimales (&#x27; → ')
  result = result.replace(/&#x([0-9a-fA-F]+);/g, (_, code) => {
    const charCode = parseInt(code, 16);
    return String.fromCharCode(charCode);
  });

  // Entités nommées courantes
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
    "&copy;": "©",
    "&reg;": "®",
    "&deg;": "°",
    "&agrave;": "à",
    "&acirc;": "â",
    "&egrave;": "è",
    "&eacute;": "é",
    "&ecirc;": "ê",
    "&icirc;": "î",
    "&ocirc;": "ô",
    "&ugrave;": "ù",
    "&ucirc;": "û",
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
    // Apostrophes → '
    .replace(/\u2019/g, "'") // ’ (RIGHT SINGLE QUOTATION MARK) ← CRITIQUE
    .replace(/\u2018/g, "'") // ‘
    .replace(/\u02BC/g, "'") // ʼ
    .replace(/`/g, "'")

    // Guillemets → "
    .replace(/[«»„“”]/g, '"')

    // Espaces insécables
    .replace(/\u00A0/g, " ");
}

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
 * Gère automatiquement le rafraîchissement du token OAuth
 */
export class GmailService {
  private gmail: gmail_v1.Gmail;
  private oauth2Client: InstanceType<typeof google.auth.OAuth2>;
  private userId: string;
  private accountId: string;
  private refreshToken: string | null;
  private accessToken: string;

  constructor(
    accessToken: string,
    userId: string,
    accountId: string,
    refreshToken: string | null
  ) {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    this.oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    this.gmail = google.gmail({
      version: "v1",
      auth: this.oauth2Client,
    });

    this.userId = userId;
    this.accountId = accountId;
    this.refreshToken = refreshToken;
    this.accessToken = accessToken;
  }

  /**
   * Rafraîchit le token d'accès et met à jour les credentials
   * Retourne true si le rafraîchissement a réussi
   */
  private async refreshAccessToken(): Promise<boolean> {
    if (!this.refreshToken) {
      console.error("[Gmail] No refresh token available - user needs to reconnect Gmail");
      return false;
    }

    try {
      console.log("[Gmail] Refreshing access token...");
      const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          grant_type: "refresh_token",
          refresh_token: this.refreshToken,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[Gmail] Failed to refresh token:", response.status, errorText);
        if (response.status === 400 || response.status === 401) {
          console.error("[Gmail] Refresh token is invalid or revoked - user must reconnect Gmail");
        }
        return false;
      }

      const data = await response.json();
      this.accessToken = data.access_token;

      // Mettre à jour les credentials du client OAuth
      this.oauth2Client.setCredentials({
        access_token: data.access_token,
        refresh_token: this.refreshToken,
      });

      // Mettre à jour le token en base de données
      await prisma.account.update({
        where: { id: this.accountId },
        data: {
          access_token: data.access_token,
          expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
        },
      });

      console.log("[Gmail] Token refreshed successfully");
      return true;
    } catch (error) {
      console.error("[Gmail] Error refreshing token:", error);
      return false;
    }
  }

  /**
   * Exécute une opération Gmail avec retry automatique sur erreur 401
   * Tente de rafraîchir le token et réessaie une fois en cas d'échec d'authentification
   */
  private async withRetryOn401<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error: unknown) {
      // Vérifier si c'est une erreur 401
      const is401Error =
        error instanceof Error &&
        (error.message.includes("401") ||
          error.message.includes("invalid authentication") ||
          error.message.includes("Invalid Credentials") ||
          (error as { code?: number }).code === 401);

      if (is401Error) {
        console.log("[Gmail] Got 401 error, attempting to refresh token and retry...");
        const refreshed = await this.refreshAccessToken();

        if (refreshed) {
          console.log("[Gmail] Retrying operation after token refresh...");
          return await operation();
        } else {
          throw new Error(
            "Token refresh failed - user must reconnect Gmail. Original error: " +
              (error instanceof Error ? error.message : String(error))
          );
        }
      }

      throw error;
    }
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
        const listResponse = await this.withRetryOn401(() =>
          this.gmail.users.messages.list({
            userId: "me",
            maxResults: pageSize,
            q: gmailQuery,
            labelIds,
            pageToken,
          })
        );

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
        const messageData = await this.withRetryOn401(() =>
          this.gmail.users.messages.get({
            userId: "me",
            id: message.id!, // Safe: vérifié au-dessus avec if (!message.id) continue
            format: "metadata", // IMPORTANT: metadata only, pas le corps complet
            metadataHeaders: ["From", "Subject", "Date"], // Headers nécessaires
          })
        );

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
    const rawSubject = getHeader("Subject");
    const dateStr = getHeader("Date");

    if (!from) {
      return null; // On ne peut pas identifier l'expéditeur, skip
    }

    // Parser la date
    const receivedAt = dateStr ? new Date(dateStr) : new Date();

    // Snippet (extrait court fourni par Gmail, max 200 caractères)
    // Décoder les entités HTML et normaliser la typographie pour éviter les incohérences lors de l'analyse
    const rawSnippet = message.snippet || "";
    const snippet = normalizeTypography(decodeHtmlEntities(decodeQuotedPrintable(rawSnippet)));

    // Normaliser le sujet également (avec décodage HTML)
    const subject = rawSubject ? normalizeTypography(decodeHtmlEntities(decodeQuotedPrintable(rawSubject))) : null;

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
      const messageData = await this.withRetryOn401(() =>
        this.gmail.users.messages.get({
          userId: "me",
          id: gmailMessageId,
          format: "metadata",
          metadataHeaders: ["From", "Subject", "Date"],
        })
      );

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
      const messageData = await this.withRetryOn401(() =>
        this.gmail.users.messages.get({
          userId: "me",
          id: gmailMessageId,
          format: "full", // Full pour accéder au corps
        })
      );

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
   * Décode automatiquement quoted-printable et normalise la typographie
   */
  private extractBody(message: gmail_v1.Schema$Message): string {
    const payload = message.payload;
    if (!payload) return "";

    // Fonction pour vérifier si une partie utilise quoted-printable
    const isQuotedPrintable = (part: gmail_v1.Schema$MessagePart): boolean => {
      const headers = part.headers || [];
      const cte = headers.find(
        (h) => h.name?.toLowerCase() === "content-transfer-encoding"
      );
      return cte?.value?.toLowerCase() === "quoted-printable";
    };

    // Fonction pour décoder le texte selon l'encodage
    const decodePartBody = (part: gmail_v1.Schema$MessagePart, data: string): string => {
      let decoded = decodeBase64Url(data);

      // Si quoted-printable, décoder les séquences =XX
      if (isQuotedPrintable(part)) {
        decoded = decodeQuotedPrintable(decoded);
      }

      // Décoder les entités HTML et normaliser la typographie
      return normalizeTypography(decodeHtmlEntities(decoded));
    };

    // Fonction pour convertir HTML en texte brut
    const htmlToText = (html: string): string => {
      return html
        // Supprimer les balises script et style avec leur contenu
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        // Convertir les sauts de ligne HTML en \n
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n\n")
        .replace(/<\/div>/gi, "\n")
        .replace(/<\/tr>/gi, "\n")
        .replace(/<\/li>/gi, "\n")
        // Supprimer toutes les autres balises HTML
        .replace(/<[^>]+>/g, "")
        // Nettoyer les espaces multiples
        .replace(/\n\s*\n\s*\n/g, "\n\n")
        .replace(/[ \t]+/g, " ")
        .trim();
    };

    // Fonction récursive pour extraire le texte des parties
    const extractFromParts = (parts: gmail_v1.Schema$MessagePart[]): string => {
      let plainText = "";
      let htmlText = "";

      for (const part of parts) {
        if (part.mimeType === "text/plain" && part.body?.data) {
          // Décoder le corps avec gestion quoted-printable
          const decoded = decodePartBody(part, part.body.data);
          plainText += decoded + "\n";
        } else if (part.mimeType === "text/html" && part.body?.data) {
          // Décoder le HTML et convertir en texte brut (fallback)
          const decoded = decodePartBody(part, part.body.data);
          htmlText += htmlToText(decoded) + "\n";
        } else if (part.parts) {
          // Récursion si multipart
          const nested = extractFromParts(part.parts);
          if (nested) {
            plainText += nested;
          }
        }
      }

      // Préférer text/plain, sinon utiliser text/html converti
      return plainText || htmlText;
    };

    // Si le corps est directement dans payload.body
    if (payload.body?.data) {
      let decoded = decodeBase64Url(payload.body.data);

      // Vérifier quoted-printable au niveau payload
      const headers = payload.headers || [];
      const cte = headers.find(
        (h) => h.name?.toLowerCase() === "content-transfer-encoding"
      );
      if (cte?.value?.toLowerCase() === "quoted-printable") {
        decoded = decodeQuotedPrintable(decoded);
      }

      // Décoder les entités HTML et normaliser la typographie
      decoded = normalizeTypography(decodeHtmlEntities(decoded));

      // Si le contenu est HTML, le convertir en texte brut
      if (payload.mimeType === "text/html") {
        return htmlToText(decoded);
      }

      return decoded;
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
      const listResponse = await this.withRetryOn401(() =>
        this.gmail.users.messages.list({
          userId: "me",
          labelIds: ["INBOX"],
          q: gmailQuery,
          maxResults: 500, // Limiter pour éviter les timeouts
        })
      );

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
 * Rafraîchit le token d'accès Google en utilisant le refresh token (fonction statique)
 * Utilisé par createGmailService pour le rafraîchissement initial
 */
async function refreshGoogleTokenStatic(
  refreshToken: string,
  accountId: string
): Promise<string | null> {
  try {
    console.log("[Gmail] Refreshing access token (static)...");
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
      const errorText = await response.text();
      console.error("[Gmail] Failed to refresh token:", response.status, errorText);
      // Si le refresh token est invalide (400/401), l'utilisateur doit reconnecter
      if (response.status === 400 || response.status === 401) {
        console.error("[Gmail] Refresh token is invalid or revoked - user must reconnect Gmail");
      }
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

    console.log("[Gmail] Token refreshed successfully (static)");
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
 * Le service créé peut rafraîchir son token dynamiquement pendant les opérations
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
      console.log("[Gmail] No Google account found or no access token for user:", userId);
      return null; // Utilisateur n'a pas connecté Gmail
    }

    if (!account.refresh_token) {
      console.error("[Gmail] No refresh token available for user:", userId);
      console.error("[Gmail] User needs to reconnect Gmail with offline access");
      return null;
    }

    let accessToken = account.access_token;

    // Vérifier si le token est expiré ou va expirer bientôt (marge de 5 minutes)
    const now = Math.floor(Date.now() / 1000);
    const expirationMargin = 5 * 60; // 5 minutes en secondes
    const shouldRefresh = !account.expires_at || account.expires_at < (now + expirationMargin);

    if (shouldRefresh) {
      // Token expiré ou expires_at non défini, essayer de le rafraîchir
      console.log("[Gmail] Access token expired or missing expires_at, refreshing before creating service...");
      const newToken = await refreshGoogleTokenStatic(
        account.refresh_token,
        account.id
      );

      if (newToken) {
        accessToken = newToken;
      } else {
        console.error("[Gmail] Failed to refresh token during service creation - user may need to reconnect Gmail");
        return null; // Échec du rafraîchissement
      }
    }

    // Créer le service avec la capacité de rafraîchir le token dynamiquement
    return new GmailService(accessToken, userId, account.id, account.refresh_token);
  } catch (error) {
    console.error("Error creating Gmail service:", error);
    return null;
  }
}

function decodeBase64Url(data: string): string {
  // Gmail API renvoie du base64url (RFC 4648 §5)
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return Buffer.from(padded, "base64").toString("utf-8");
}
