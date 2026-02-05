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
export { IMAPProvider } from "./imap-provider";
export { MicrosoftGraphProvider } from "./microsoft-graph-provider";

// Factory
export {
  createEmailProvider,
  createIMAPProvider,
  createMicrosoftGraphProvider,
} from "./factory";
