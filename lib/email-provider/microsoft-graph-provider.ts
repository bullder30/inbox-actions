/**
 * Adapter Microsoft Graph pour l'interface IEmailProvider
 * Encapsule MicrosoftGraphService pour respecter l'interface commune
 */

import type { EmailProvider } from "@prisma/client";
import { MicrosoftGraphService } from "@/lib/microsoft-graph/graph-service";
import { prisma } from "@/lib/db";
import type {
  IEmailProvider,
  EmailMetadata,
  FetchOptions,
  ConnectionStatus,
} from "./interface";

export class MicrosoftGraphProvider implements IEmailProvider {
  readonly providerType: EmailProvider = "MICROSOFT_GRAPH";
  readonly mailboxId: string;
  readonly mailboxLabel: string | null;
  private userId: string;

  constructor(
    private service: MicrosoftGraphService,
    userId: string,
    mailboxLabel: string | null = null
  ) {
    this.userId = userId;
    this.mailboxId = service.mailboxId;
    this.mailboxLabel = mailboxLabel;
  }

  async fetchNewEmails(options?: FetchOptions): Promise<EmailMetadata[]> {
    const emails = await this.service.fetchNewEmails({
      maxResults: options?.maxResults,
      folder: options?.folder || "inbox",
    });

    return emails.map((email) => ({
      // Graph uses gmailMessageId field for its message ID (field reuse)
      gmailMessageId: email.graphMessageId,
      gmailThreadId: email.conversationId,
      imapUID: null,
      imapMessageId: null,
      from: email.from,
      subject: email.subject,
      snippet: email.snippet,
      receivedAt: email.receivedAt,
      labels: email.labels,
      webUrl: email.webUrl,
      emailProvider: "MICROSOFT_GRAPH" as EmailProvider,
    }));
  }

  async getEmailBodyForAnalysis(
    messageId: string | bigint
  ): Promise<string | null> {
    // Graph uses string IDs
    const graphMessageId =
      typeof messageId === "string" ? messageId : messageId.toString();
    return this.service.getEmailBodyForAnalysis(graphMessageId);
  }

  async getExtractedEmails(): Promise<EmailMetadata[]> {
    const emails = await this.service.getExtractedEmails();

    return emails.map((email) => ({
      gmailMessageId: email.graphMessageId,
      gmailThreadId: email.conversationId,
      imapUID: null,
      imapMessageId: null,
      from: email.from,
      subject: email.subject,
      snippet: email.snippet,
      receivedAt: email.receivedAt,
      labels: email.labels,
      webUrl: email.webUrl,
      emailProvider: "MICROSOFT_GRAPH" as EmailProvider,
    }));
  }

  async markEmailAsAnalyzed(messageId: string | bigint): Promise<void> {
    const graphMessageId =
      typeof messageId === "string" ? messageId : messageId.toString();
    await this.service.markEmailAsAnalyzed(graphMessageId);
  }

  async countNewEmails(): Promise<number> {
    return this.service.countNewEmails();
  }

  async disconnect(): Promise<void> {
    await this.service.disconnect();
  }

  async getStatus(): Promise<ConnectionStatus> {
    const mailbox = await prisma.microsoftGraphMailbox.findUnique({
      where: { id: this.mailboxId },
      select: { lastSync: true },
    });

    return {
      isConnected: true,
      lastSync: mailbox?.lastSync || null,
      lastError: null,
      provider: "MICROSOFT_GRAPH",
    };
  }
}
