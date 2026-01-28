/**
 * Email Provider module exports
 */

// Interface
export type {
  IEmailProvider,
  EmailMetadata,
  FetchOptions,
  SyncResult,
  ConnectionStatus,
} from "./interface";

// Providers
export { GmailProvider } from "./gmail-provider";
export { IMAPProvider } from "./imap-provider";

// Factory
export {
  createEmailProvider,
  createGmailProvider,
  createIMAPProvider,
} from "./factory";
