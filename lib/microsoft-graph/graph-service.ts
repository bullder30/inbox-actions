/**
 * Microsoft Graph API Service
 * Fetches emails from Microsoft 365 / Outlook using Graph API
 *
 * Rate Limits:
 * - 10,000 requests per 10 minutes per mailbox
 * - 4 concurrent requests
 *
 * @see https://learn.microsoft.com/en-us/graph/api/resources/mail-api-overview
 */

import { prisma } from "@/lib/db";
import { getMicrosoftGraphToken, type TokenResult } from "./graph-oauth-helper";
import type {
  GraphMessage,
  GraphDeltaResponse,
  GraphMessagesResponse,
  GraphFetchOptions,
  GraphEmailMetadata,
} from "./types";

const GRAPH_API_BASE = "https://graph.microsoft.com/v1.0";
const DEFAULT_PAGE_SIZE = 100;
const MAX_RETRIES = 3;

/**
 * Decodes HTML entities in text
 */
function decodeHtmlEntities(text: string): string {
  // Numeric entities
  let result = text.replace(/&#(\d+);/g, (_, code) => {
    return String.fromCharCode(parseInt(code, 10));
  });
  result = result.replace(/&#x([0-9a-fA-F]+);/g, (_, code) => {
    return String.fromCharCode(parseInt(code, 16));
  });

  // Named entities
  const entities: { [key: string]: string } = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&apos;": "'",
    "&nbsp;": " ",
    "&ndash;": "-",
    "&mdash;": "-",
    "&lsquo;": "'",
    "&rsquo;": "'",
    "&ldquo;": '"',
    "&rdquo;": '"',
    "&hellip;": "...",
  };

  for (const [entity, char] of Object.entries(entities)) {
    result = result.replace(new RegExp(entity, "gi"), char);
  }

  return result;
}

/**
 * Normalizes typography (apostrophes, quotes, spaces)
 */
function normalizeTypography(text: string): string {
  return text
    .replace(/[\u2018\u2019\u02BC`]/g, "'")
    .replace(/[\u00AB\u00BB\u201E\u201C\u201D]/g, '"')
    .replace(/\u00A0/g, " ");
}

/**
 * Converts HTML to plain text
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
 * Microsoft Graph API Service
 */
export class MicrosoftGraphService {
  private accessToken: string;
  private userId: string;
  private accountId: string;
  private refreshToken: string | null;

  constructor(tokenResult: TokenResult, userId: string) {
    this.accessToken = tokenResult.accessToken;
    this.accountId = tokenResult.accountId;
    this.refreshToken = tokenResult.refreshToken;
    this.userId = userId;
  }

  /**
   * Makes a Graph API request with automatic retry on 429 (rate limit)
   */
  private async graphRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(`${GRAPH_API_BASE}${endpoint}`, {
          ...options,
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
            Prefer: 'outlook.body-content-type="text"',
            ...options.headers,
          },
        });

        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = response.headers.get("Retry-After") || "60";
          const waitMs = parseInt(retryAfter, 10) * 1000;
          console.log(`[Graph] Rate limited, waiting ${retryAfter}s before retry...`);
          await this.sleep(waitMs);
          continue;
        }

        // Handle token expiration
        if (response.status === 401) {
          console.log("[Graph] Token expired, attempting refresh...");
          const newToken = await getMicrosoftGraphToken(this.userId);
          if (newToken) {
            this.accessToken = newToken.accessToken;
            continue; // Retry with new token
          }
          throw new Error("Token refresh failed - user must reconnect");
        }

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Graph API error ${response.status}: ${errorText}`);
        }

        return await response.json();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < MAX_RETRIES - 1) {
          // Exponential backoff
          const waitMs = Math.pow(2, attempt) * 1000;
          console.log(`[Graph] Request failed, retrying in ${waitMs}ms...`);
          await this.sleep(waitMs);
        }
      }
    }

    throw lastError || new Error("Graph API request failed after retries");
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Fetches new emails from inbox
   * Uses delta query for incremental sync if deltaLink is available
   */
  async fetchNewEmails(
    options: GraphFetchOptions = {}
  ): Promise<GraphEmailMetadata[]> {
    const { maxResults, folder = "inbox" } = options;

    try {
      // Get user's sync state
      const user = await prisma.user.findUnique({
        where: { id: this.userId },
        select: { lastEmailSync: true, microsoftDeltaLink: true },
      });

      const allMessages: GraphMessage[] = [];
      let nextLink: string | undefined;
      let deltaLink: string | undefined;

      // If we have a delta link, use it for incremental sync
      if (user?.microsoftDeltaLink) {
        console.log("[Graph] Using delta query for incremental sync");
        const result = await this.fetchWithDelta(user.microsoftDeltaLink, maxResults);
        allMessages.push(...result.messages);
        deltaLink = result.deltaLink;
      } else {
        // First sync: fetch from inbox
        console.log("[Graph] First sync: fetching from inbox");

        // Calculate time filter (last 24h for first sync)
        const sinceDate = user?.lastEmailSync || new Date(Date.now() - 24 * 60 * 60 * 1000);
        const filter = `receivedDateTime ge ${sinceDate.toISOString()}`;

        const endpoint = `/me/mailFolders/${folder}/messages?$top=${maxResults || DEFAULT_PAGE_SIZE}&$filter=${encodeURIComponent(filter)}&$orderby=receivedDateTime desc&$select=id,conversationId,subject,bodyPreview,from,receivedDateTime,parentFolderId,categories,webLink`;

        let currentEndpoint: string | undefined = endpoint;

        while (currentEndpoint) {
          const response = await this.graphRequest<GraphMessagesResponse>(currentEndpoint);
          allMessages.push(...response.value);

          // Check pagination
          if (response["@odata.nextLink"] && (!maxResults || allMessages.length < maxResults)) {
            // Extract path from full URL
            currentEndpoint = response["@odata.nextLink"].replace(GRAPH_API_BASE, "");
          } else {
            currentEndpoint = undefined;
          }
        }

        // Now get delta link for future incremental syncs
        const deltaEndpoint = `/me/mailFolders/${folder}/messages/delta?$select=id,conversationId,subject,bodyPreview,from,receivedDateTime,parentFolderId,categories,webLink`;
        const deltaResponse = await this.initializeDelta(deltaEndpoint);
        deltaLink = deltaResponse.deltaLink;
      }

      console.log(`[Graph] Fetched ${allMessages.length} messages`);

      // Convert to our metadata format and save
      const emailsMetadata: GraphEmailMetadata[] = [];

      for (const message of allMessages) {
        // Skip deleted messages (from delta)
        if (message["@removed"]) continue;

        // Check if already exists
        const existing = await prisma.emailMetadata.findFirst({
          where: {
            userId: this.userId,
            gmailMessageId: message.id, // We reuse gmailMessageId for Graph
          },
        });

        if (existing) continue;

        const metadata = this.extractMetadata(message);
        if (metadata) {
          emailsMetadata.push(metadata);

          // Save to database
          await prisma.emailMetadata.create({
            data: {
              userId: this.userId,
              emailProvider: "MICROSOFT_GRAPH",
              gmailMessageId: metadata.graphMessageId, // Reuse field
              gmailThreadId: metadata.conversationId, // Reuse field
              from: metadata.from,
              subject: metadata.subject,
              snippet: metadata.snippet,
              receivedAt: metadata.receivedAt,
              labels: metadata.labels,
              webUrl: metadata.webUrl,
              status: "EXTRACTED",
            },
          });
        }
      }

      // Update user sync state
      await prisma.user.update({
        where: { id: this.userId },
        data: {
          lastEmailSync: new Date(),
          microsoftDeltaLink: deltaLink,
        },
      });

      return emailsMetadata;
    } catch (error) {
      console.error("[Graph] Error fetching emails:", error);
      throw error;
    }
  }

  /**
   * Fetches emails using delta link
   */
  private async fetchWithDelta(
    deltaLink: string,
    maxResults?: number
  ): Promise<{ messages: GraphMessage[]; deltaLink?: string }> {
    const messages: GraphMessage[] = [];
    let currentLink: string | undefined = deltaLink;
    let newDeltaLink: string | undefined;

    while (currentLink) {
      // Delta links are full URLs, need to extract path
      const endpoint = currentLink.includes(GRAPH_API_BASE)
        ? currentLink.replace(GRAPH_API_BASE, "")
        : currentLink;

      const response = await this.graphRequest<GraphDeltaResponse>(endpoint);
      messages.push(...response.value);

      if (response["@odata.nextLink"]) {
        currentLink = response["@odata.nextLink"];
      } else {
        newDeltaLink = response["@odata.deltaLink"];
        currentLink = undefined;
      }

      // Respect maxResults if set
      if (maxResults && messages.length >= maxResults) break;
    }

    return { messages, deltaLink: newDeltaLink };
  }

  /**
   * Initializes delta tracking by fetching all pages until we get a deltaLink
   */
  private async initializeDelta(
    deltaEndpoint: string
  ): Promise<{ deltaLink?: string }> {
    let currentEndpoint: string | undefined = deltaEndpoint;
    let deltaLink: string | undefined;

    // We need to consume all pages to get the deltaLink
    while (currentEndpoint) {
      const response = await this.graphRequest<GraphDeltaResponse>(currentEndpoint);

      if (response["@odata.nextLink"]) {
        currentEndpoint = response["@odata.nextLink"].replace(GRAPH_API_BASE, "");
      } else {
        deltaLink = response["@odata.deltaLink"];
        currentEndpoint = undefined;
      }
    }

    return { deltaLink };
  }

  /**
   * Extracts metadata from a Graph message
   */
  private extractMetadata(message: GraphMessage): GraphEmailMetadata | null {
    if (!message.id || !message.from?.emailAddress?.address) {
      return null;
    }

    const fromEmail = message.from.emailAddress.address;
    const fromName = message.from.emailAddress.name;
    const fromFormatted = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

    // Process snippet
    const rawSnippet = message.bodyPreview || "";
    const snippet = normalizeTypography(decodeHtmlEntities(rawSnippet)).slice(0, 200);

    // Process subject
    const subject = message.subject
      ? normalizeTypography(decodeHtmlEntities(message.subject))
      : null;

    return {
      graphMessageId: message.id,
      conversationId: message.conversationId || null,
      from: fromFormatted,
      subject,
      snippet,
      receivedAt: new Date(message.receivedDateTime),
      labels: message.categories || [],
      webUrl: message.webLink || null,
    };
  }

  /**
   * Gets email body for analysis (temporary, not stored)
   */
  async getEmailBodyForAnalysis(messageId: string): Promise<string | null> {
    try {
      const response = await this.graphRequest<GraphMessage>(
        `/me/messages/${messageId}?$select=body`
      );

      if (!response.body?.content) {
        return null;
      }

      let content = response.body.content;

      // Convert HTML to text if needed
      if (response.body.contentType === "html") {
        content = htmlToText(content);
      }

      // Normalize
      content = normalizeTypography(decodeHtmlEntities(content));

      return content;
    } catch (error) {
      console.error(`[Graph] Error fetching email body ${messageId}:`, error);
      return null;
    }
  }

  /**
   * Gets emails with EXTRACTED status (not yet analyzed)
   */
  async getExtractedEmails(): Promise<GraphEmailMetadata[]> {
    const emails = await prisma.emailMetadata.findMany({
      where: {
        userId: this.userId,
        emailProvider: "MICROSOFT_GRAPH",
        status: "EXTRACTED",
      },
      orderBy: {
        receivedAt: "desc",
      },
    });

    return emails.map((email) => ({
      graphMessageId: email.gmailMessageId!, // Reused field
      conversationId: email.gmailThreadId, // Reused field
      from: email.from,
      subject: email.subject,
      snippet: email.snippet,
      receivedAt: email.receivedAt,
      labels: email.labels,
      webUrl: email.webUrl,
    }));
  }

  /**
   * Marks an email as analyzed
   */
  async markEmailAsAnalyzed(messageId: string): Promise<void> {
    await prisma.emailMetadata.updateMany({
      where: {
        userId: this.userId,
        gmailMessageId: messageId, // Reused field
        emailProvider: "MICROSOFT_GRAPH",
      },
      data: {
        status: "ANALYZED",
      },
    });
  }

  /**
   * Counts new emails that haven't been synced yet
   */
  async countNewEmails(): Promise<number> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: this.userId },
        select: { lastEmailSync: true },
      });

      // Calculate since when to count
      const sinceDate = user?.lastEmailSync || new Date(Date.now() - 24 * 60 * 60 * 1000);
      const filter = `receivedDateTime ge ${sinceDate.toISOString()}`;

      const response = await this.graphRequest<{ "@odata.count"?: number; value: GraphMessage[] }>(
        `/me/mailFolders/inbox/messages?$count=true&$filter=${encodeURIComponent(filter)}&$top=1`
      );

      const totalInGraph = response["@odata.count"] || response.value.length;

      // Count already synced
      const syncedCount = await prisma.emailMetadata.count({
        where: {
          userId: this.userId,
          emailProvider: "MICROSOFT_GRAPH",
          receivedAt: { gte: sinceDate },
        },
      });

      return Math.max(0, totalInGraph - syncedCount);
    } catch (error) {
      console.error("[Graph] Error counting new emails:", error);
      return 0;
    }
  }

  /**
   * Disconnects the service (cleanup)
   */
  async disconnect(): Promise<void> {
    // Clear delta link on disconnect
    await prisma.user.update({
      where: { id: this.userId },
      data: {
        microsoftDeltaLink: null,
        lastEmailSync: null,
      },
    });
  }
}

/**
 * Factory function to create a MicrosoftGraphService instance
 */
export async function createMicrosoftGraphService(
  userId: string
): Promise<MicrosoftGraphService | null> {
  try {
    const tokenResult = await getMicrosoftGraphToken(userId);
    if (!tokenResult) {
      console.log("[Graph] Failed to get token for user:", userId);
      return null;
    }

    return new MicrosoftGraphService(tokenResult, userId);
  } catch (error) {
    console.error("[Graph] Error creating service:", error);
    return null;
  }
}
