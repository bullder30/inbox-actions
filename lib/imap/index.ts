/**
 * IMAP module exports
 */

export { IMAPService, createIMAPService } from "./imap-service";
export { encryptPassword, decryptPassword, validateMasterKey, generateMasterKey } from "./imap-credentials";
export type {
  IMAPConfig,
  FetchEmailsOptions,
  EmailMetadataType,
  SyncResult,
  AnalyzeResult,
  IMAPStatus,
  IMAPFolder,
  EmailBodyForAnalysis,
} from "./types";
export { IMAP_PRESETS, detectProviderFromEmail } from "./types";
