/**
 * Adapter Gmail pour l'interface IEmailProvider
 * Encapsule GmailService pour respecter l'interface commune
 */

import type { EmailProvider } from "@prisma/client";
import { GmailService } from "@/lib/gmail/gmail-service";
import type {
  IEmailProvider,
  EmailMetadata,
  FetchOptions,
  ConnectionStatus,
} from "./interface";

export class GmailProvider implements IEmailProvider {
  readonly providerType: EmailProvider = "GMAIL";

  constructor(private service: GmailService) {}

  async fetchNewEmails(options?: FetchOptions): Promise<EmailMetadata[]> {
    const emails = await this.service.fetchNewEmails({
      maxResults: options?.maxResults,
      labelIds: options?.folder ? [options.folder] : ["INBOX"],
    });

    return emails.map((email) => ({
      gmailMessageId: email.gmailMessageId,
      gmailThreadId: email.gmailThreadId,
      imapUID: null,
      imapMessageId: null,
      from: email.from,
      subject: email.subject,
      snippet: email.snippet,
      receivedAt: email.receivedAt,
      labels: email.labels,
      emailProvider: "GMAIL" as EmailProvider,
    }));
  }

  async getEmailBodyForAnalysis(
    messageId: string | bigint
  ): Promise<string | null> {
    // Gmail utilise des string IDs
    const gmailMessageId =
      typeof messageId === "string" ? messageId : messageId.toString();
    return this.service.getEmailBodyForAnalysis(gmailMessageId);
  }

  async getExtractedEmails(): Promise<EmailMetadata[]> {
    const emails = await this.service.getExtractedEmails();

    return emails.map((email) => ({
      gmailMessageId: email.gmailMessageId,
      gmailThreadId: email.gmailThreadId,
      imapUID: null,
      imapMessageId: null,
      from: email.from,
      subject: email.subject,
      snippet: email.snippet,
      receivedAt: email.receivedAt,
      labels: email.labels,
      emailProvider: "GMAIL" as EmailProvider,
    }));
  }

  async markEmailAsAnalyzed(messageId: string | bigint): Promise<void> {
    const gmailMessageId =
      typeof messageId === "string" ? messageId : messageId.toString();
    await this.service.markEmailAsAnalyzed(gmailMessageId);
  }

  async countNewEmails(): Promise<number> {
    return this.service.countNewEmailsInGmail();
  }

  async disconnect(): Promise<void> {
    // Gmail API n'a pas besoin de déconnexion explicite
  }

  async getStatus(): Promise<ConnectionStatus> {
    // Gmail est considéré comme connecté si le service existe
    // TODO: Améliorer en vérifiant vraiment le token
    return {
      isConnected: true,
      lastSync: null, // TODO: Récupérer depuis la DB
      lastError: null,
      provider: "GMAIL",
    };
  }
}
