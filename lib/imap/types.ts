import type { EmailProvider, EmailStatus } from "@prisma/client";

/**
 * Authentication method for IMAP
 */
export type IMAPAuthMethod = "PASSWORD" | "OAUTH";

/**
 * Configuration for IMAP connection
 */
export interface IMAPConfig {
  host: string;
  port: number;
  username: string;
  password?: string; // Plain text (decrypted) - App Password (for PASSWORD auth)
  accessToken?: string; // OAuth2 access token (for OAUTH auth)
  authMethod: IMAPAuthMethod;
  folder?: string;
  useTLS?: boolean;
}

/**
 * Options for fetching emails
 */
export interface FetchEmailsOptions {
  maxResults?: number;
  sinceUID?: bigint;
  folder?: string;
}

/**
 * Parsed email metadata (provider-agnostic)
 */
export interface EmailMetadataType {
  // Identifiers
  gmailMessageId?: string | null;
  gmailThreadId?: string | null;
  imapUID?: bigint | null;
  imapMessageId?: string | null;

  // Common metadata
  from: string;
  subject: string | null;
  snippet: string;
  receivedAt: Date;
  labels: string[];

  // URL vers l'email dans le webmail (si disponible)
  webUrl?: string | null;

  // Provider info
  emailProvider: EmailProvider;
}

/**
 * Result of email sync operation
 */
export interface SyncResult {
  success: boolean;
  syncedCount: number;
  errors: string[];
  lastUID?: bigint;
}

/**
 * Result of email analysis operation
 */
export interface AnalyzeResult {
  success: boolean;
  analyzedCount: number;
  actionsCreated: number;
  errors: string[];
}

/**
 * IMAP connection status
 */
export interface IMAPStatus {
  isConnected: boolean;
  lastSync: Date | null;
  lastError: string | null;
  lastErrorAt: Date | null;
  emailCount?: number;
}

/**
 * IMAP folder info
 */
export interface IMAPFolder {
  name: string;
  path: string;
  flags: string[];
  delimiter: string;
}

/**
 * Common email body structure for analysis
 */
export interface EmailBodyForAnalysis {
  text: string | null;
  html: string | null;
  from: string;
  subject: string | null;
  receivedAt: Date;
}

/**
 * Preset IMAP configurations for common providers
 */
export const IMAP_PRESETS: Record<
  string,
  { host: string; port: number; useTLS: boolean; name: string }
> = {
  gmail: {
    host: "imap.gmail.com",
    port: 993,
    useTLS: true,
    name: "Gmail",
  },
  // Note: Outlook/Microsoft removed - use Microsoft Graph API instead
  yahoo: {
    host: "imap.mail.yahoo.com",
    port: 993,
    useTLS: true,
    name: "Yahoo Mail",
  },
  icloud: {
    host: "imap.mail.me.com",
    port: 993,
    useTLS: true,
    name: "iCloud Mail",
  },
  protonmail: {
    host: "127.0.0.1", // ProtonMail Bridge
    port: 1143,
    useTLS: false,
    name: "ProtonMail (via Bridge)",
  },
  fastmail: {
    host: "imap.fastmail.com",
    port: 993,
    useTLS: true,
    name: "Fastmail",
  },
};

/**
 * Detect provider from email address
 * Returns the IMAP preset key, or "microsoft" for Microsoft accounts (which should use Graph API)
 */
export function detectProviderFromEmail(
  email: string
): keyof typeof IMAP_PRESETS | "microsoft" | null {
  const domain = email.split("@")[1]?.toLowerCase();

  if (!domain) return null;

  if (domain === "gmail.com" || domain.endsWith(".gmail.com")) {
    return "gmail";
  }
  // Microsoft accounts - should use Graph API, not IMAP
  if (
    domain === "outlook.com" ||
    domain === "hotmail.com" ||
    domain === "live.com" ||
    domain.endsWith(".outlook.com") ||
    domain === "outlook.fr" ||
    domain === "hotmail.fr"
  ) {
    return "microsoft";
  }
  if (domain === "yahoo.com" || domain.endsWith(".yahoo.com")) {
    return "yahoo";
  }
  if (
    domain === "icloud.com" ||
    domain === "me.com" ||
    domain === "mac.com"
  ) {
    return "icloud";
  }
  if (domain === "protonmail.com" || domain === "pm.me") {
    return "protonmail";
  }
  if (domain === "fastmail.com" || domain.endsWith(".fastmail.com")) {
    return "fastmail";
  }

  return null;
}

/**
 * Check if a provider is Microsoft (should use Graph API instead of IMAP)
 */
export function isMicrosoftProvider(provider: string | null): boolean {
  return provider === "microsoft";
}

/**
 * Generate a Gmail web URL from the Message-ID header
 * Gmail supports searching by rfc822msgid
 */
export function generateGmailWebUrl(messageId: string | null): string | null {
  if (!messageId) return null;

  // Encode the Message-ID for URL (remove < > if present)
  const cleanMessageId = messageId.replace(/^<|>$/g, "");
  const encodedMessageId = encodeURIComponent(`rfc822msgid:${cleanMessageId}`);

  return `https://mail.google.com/mail/u/0/#search/${encodedMessageId}`;
}

/**
 * Check if an IMAP host is Gmail
 */
export function isGmailHost(host: string): boolean {
  return host.toLowerCase() === "imap.gmail.com";
}
