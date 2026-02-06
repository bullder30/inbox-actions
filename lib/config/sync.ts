/**
 * Configuration de synchronisation des emails
 * Utilisé par le cron job et les endpoints manuels
 */

/**
 * Nombre maximum d'emails à synchroniser par exécution
 * S'applique à fetchNewEmails()
 */
export const MAX_EMAILS_TO_SYNC = 100;

/**
 * Nombre maximum d'emails à analyser par exécution
 * S'applique à getExtractedEmails() + extraction d'actions
 */
export const MAX_EMAILS_TO_ANALYZE = 50;
