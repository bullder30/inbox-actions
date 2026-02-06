/**
 * Interface commune pour les providers email (Gmail, IMAP, etc.)
 * Permet d'utiliser différents providers de manière interchangeable
 */

import type { EmailProvider } from "@prisma/client";

/**
 * Métadonnées d'email (provider-agnostic)
 */
export interface EmailMetadata {
  // Identifiers (dépendent du provider)
  gmailMessageId?: string | null;
  gmailThreadId?: string | null;
  imapUID?: bigint | null;
  imapMessageId?: string | null;

  // Métadonnées communes
  from: string;
  subject: string | null;
  snippet: string;
  receivedAt: Date;
  labels: string[];

  // URL vers l'email dans le webmail (si disponible)
  webUrl?: string | null;

  // Provider source
  emailProvider: EmailProvider;
}

/**
 * Options pour la récupération des emails
 */
export interface FetchOptions {
  maxResults?: number;
  folder?: string;
}

/**
 * Résultat d'une opération de sync
 */
export interface SyncResult {
  success: boolean;
  count: number;
  errors: string[];
}

/**
 * Statut de connexion
 */
export interface ConnectionStatus {
  isConnected: boolean;
  lastSync: Date | null;
  lastError: string | null;
  provider: EmailProvider;
}

/**
 * Interface commune pour tous les providers email
 */
export interface IEmailProvider {
  /**
   * Le type de provider
   */
  readonly providerType: EmailProvider;

  /**
   * Récupère les nouveaux emails depuis le dernier sync
   * Stocke uniquement les métadonnées minimales (RGPD compliant)
   */
  fetchNewEmails(options?: FetchOptions): Promise<EmailMetadata[]>;

  /**
   * Récupère le corps d'un email pour analyse (usage temporaire uniquement)
   * IMPORTANT: Ne jamais stocker le résultat en base de données
   *
   * @param messageId - L'identifiant du message (gmailMessageId ou imapUID selon le provider)
   */
  getEmailBodyForAnalysis(messageId: string | bigint): Promise<string | null>;

  /**
   * Récupère les emails extraits (EXTRACTED) qui n'ont pas encore été analysés
   */
  getExtractedEmails(): Promise<EmailMetadata[]>;

  /**
   * Marque un email comme analysé (ANALYZED)
   *
   * @param messageId - L'identifiant du message (gmailMessageId ou imapUID selon le provider)
   */
  markEmailAsAnalyzed(messageId: string | bigint): Promise<void>;

  /**
   * Compte le nombre de nouveaux emails non synchronisés
   */
  countNewEmails(): Promise<number>;

  /**
   * Déconnecte le provider (ferme les connexions, etc.)
   */
  disconnect(): Promise<void>;

  /**
   * Récupère le statut de connexion
   */
  getStatus(): Promise<ConnectionStatus>;
}
