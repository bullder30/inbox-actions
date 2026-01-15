/**
 * API Client pour Gmail
 * Helpers TypeScript pour consommer l'API Gmail côté frontend
 */

export type GmailStatus = {
  connected: boolean;
  hasGmailScope: boolean;
  tokenExpired: boolean;
  lastSync: string | null;
  emailCount: number;
  extractedCount: number;
  analyzedCount: number;
  needsReconnection: boolean;
};

export type GmailSyncResponse = {
  success: boolean;
  count: number;
  emails: {
    id: string;
    from: string;
    subject: string | null;
    snippet: string;
    receivedAt: string;
    labels: string[];
  }[];
  message: string;
};

export type GmailDisconnectResponse = {
  success: boolean;
  message: string;
  deletedEmails: number;
};

export type GmailAnalyzeResponse = {
  success: boolean;
  processedEmails: number;
  extractedActions: number;
  skippedEmails: number;
  message: string;
};

/**
 * Vérifie le statut de connexion Gmail
 */
export async function getGmailStatus(): Promise<GmailStatus> {
  const response = await fetch("/api/gmail/status");

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Erreur lors de la vérification du statut Gmail");
  }

  return response.json();
}

/**
 * Synchronise les emails depuis Gmail
 * Si maxResults n'est pas fourni, extrait TOUS les emails depuis la dernière synchro
 */
export async function syncGmail(options?: {
  maxResults?: number;
  query?: string;
}): Promise<GmailSyncResponse> {
  const searchParams = new URLSearchParams();

  if (options?.maxResults) {
    searchParams.append("maxResults", options.maxResults.toString());
  }
  if (options?.query) {
    searchParams.append("query", options.query);
  }

  const url = `/api/gmail/sync${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;

  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Erreur lors de la synchronisation Gmail");
  }

  return response.json();
}

/**
 * Déconnecte Gmail et supprime toutes les données
 */
export async function disconnectGmail(): Promise<GmailDisconnectResponse> {
  const response = await fetch("/api/gmail/disconnect", {
    method: "POST",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Erreur lors de la déconnexion de Gmail");
  }

  return response.json();
}

/**
 * Analyse les emails EXTRACTED et extrait les actions
 * Si maxEmails n'est pas fourni, analyse TOUS les emails EXTRACTED
 */
export async function analyzeGmail(options?: {
  maxEmails?: number;
}): Promise<GmailAnalyzeResponse> {
  const response = await fetch("/api/gmail/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(options || {}),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Erreur lors de l'analyse des emails");
  }

  return response.json();
}
