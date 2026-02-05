/**
 * Adapter IMAP pour l'interface IEmailProvider
 * Encapsule IMAPService pour respecter l'interface commune
 */

import type { EmailProvider } from "@prisma/client";
import { IMAPService } from "@/lib/imap/imap-service";
import type {
  IEmailProvider,
  EmailMetadata,
  FetchOptions,
  ConnectionStatus,
} from "./interface";

export class IMAPProvider implements IEmailProvider {
  readonly providerType: EmailProvider = "IMAP";

  constructor(private service: IMAPService) {}

  async fetchNewEmails(options?: FetchOptions): Promise<EmailMetadata[]> {
    const emails = await this.service.fetchNewEmails({
      maxResults: options?.maxResults,
      folder: options?.folder,
    });

    return emails.map((email) => ({
      gmailMessageId: email.gmailMessageId,
      gmailThreadId: email.gmailThreadId,
      imapUID: email.imapUID,
      imapMessageId: email.imapMessageId,
      from: email.from,
      subject: email.subject,
      snippet: email.snippet,
      receivedAt: email.receivedAt,
      labels: email.labels,
      emailProvider: "IMAP" as EmailProvider,
    }));
  }

  async getEmailBodyForAnalysis(
    messageId: string | bigint
  ): Promise<string | null> {
    // IMAP utilise des bigint UIDs
    const imapUID =
      typeof messageId === "bigint" ? messageId : BigInt(messageId);
    return this.service.getEmailBodyForAnalysis(imapUID);
  }

  async getExtractedEmails(): Promise<EmailMetadata[]> {
    const emails = await this.service.getExtractedEmails();

    return emails.map((email) => ({
      gmailMessageId: email.gmailMessageId,
      gmailThreadId: email.gmailThreadId,
      imapUID: email.imapUID,
      imapMessageId: email.imapMessageId,
      from: email.from,
      subject: email.subject,
      snippet: email.snippet,
      receivedAt: email.receivedAt,
      labels: email.labels,
      emailProvider: "IMAP" as EmailProvider,
    }));
  }

  async markEmailAsAnalyzed(messageId: string | bigint): Promise<void> {
    const imapUID =
      typeof messageId === "bigint" ? messageId : BigInt(messageId);
    await this.service.markEmailAsAnalyzed(imapUID);
  }

  async countNewEmails(): Promise<number> {
    return this.service.countNewEmailsInImap();
  }

  async disconnect(): Promise<void> {
    await this.service.disconnect();
  }

  async getStatus(): Promise<ConnectionStatus> {
    const status = await this.service.getStatus();

    return {
      isConnected: status.isConnected,
      lastSync: status.lastSync,
      lastError: status.lastError,
      provider: "IMAP",
    };
  }
}
