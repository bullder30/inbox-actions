/**
 * Cache RAM in-process pour les corps d'emails fetchés via /api/email/[id]/body.
 *
 * - TTL : 5 minutes (cf. ADR-006)
 * - LRU bornée par user (max 100 entrées)
 * - Pas de persistance disque (RGPD strict)
 *
 * Note V2 : si l'app se déploie multi-instance, ce cache est best-effort
 * (chaque instance a sa Map). Acceptable au MVP car TTL court.
 */

const TTL_MS = 5 * 60 * 1000; // 5 min
const MAX_ENTRIES_PER_USER = 100;

export type CachedMimeType = "text/plain" | "text/html";

export interface CachedBody {
  body: string;
  mimeType: CachedMimeType;
  truncated: boolean;
  expiresAt: number;
}

// Map<userId, Map<emailId, CachedBody>>
const cacheByUser = new Map<string, Map<string, CachedBody>>();

function getUserCache(userId: string): Map<string, CachedBody> {
  let userCache = cacheByUser.get(userId);
  if (!userCache) {
    userCache = new Map();
    cacheByUser.set(userId, userCache);
  }
  return userCache;
}

/**
 * Retourne le corps mis en cache si encore valide, sinon `null`.
 */
export function getCachedBody(
  userId: string,
  emailId: string
): CachedBody | null {
  const userCache = cacheByUser.get(userId);
  if (!userCache) return null;

  const entry = userCache.get(emailId);
  if (!entry) return null;

  if (entry.expiresAt < Date.now()) {
    userCache.delete(emailId);
    return null;
  }

  return entry;
}

/**
 * Stocke un corps en cache. GC simple : supprime les entrées expirées
 * et si on dépasse la borne LRU, vire la plus ancienne.
 */
export function setCachedBody(
  userId: string,
  emailId: string,
  value: Omit<CachedBody, "expiresAt">
): void {
  const userCache = getUserCache(userId);
  const now = Date.now();

  // GC entrées expirées
  const expiredKeys: string[] = [];
  userCache.forEach((entry, id) => {
    if (entry.expiresAt < now) expiredKeys.push(id);
  });
  for (const id of expiredKeys) userCache.delete(id);

  // LRU cap : si on dépasse, supprimer la plus ancienne (head Map)
  if (userCache.size >= MAX_ENTRIES_PER_USER) {
    const firstKey = userCache.keys().next().value;
    if (firstKey !== undefined) userCache.delete(firstKey);
  }

  userCache.set(emailId, {
    ...value,
    expiresAt: now + TTL_MS,
  });
}

/**
 * Reset complet — réservé aux tests pour éviter la pollution entre suites.
 */
export function __resetCacheForTests(): void {
  cacheByUser.clear();
}
