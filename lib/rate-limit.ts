/**
 * Rate limiting léger en mémoire (sliding window).
 *
 * MVP : Map per-process. Suffit pour Vercel single-region en production
 * normale. **Limite** : sur Vercel multi-instances, chaque instance a
 * sa propre Map → un attaquant distribué peut multiplier la limite par
 * le nombre d'instances. Acceptable comme baseline anti-spam.
 *
 * Upgrade futur : `@upstash/ratelimit` + Redis Upstash (free tier
 * 10K commandes/jour suffit) pour un rate limit global multi-instances.
 *
 * Voir security-audit.md M-2 pour le rationale.
 */

interface Bucket {
  /** Timestamps (ms) des requêtes dans la fenêtre courante */
  hits: number[];
}

interface RateLimitOptions {
  /** Nombre max de requêtes dans la fenêtre */
  max: number;
  /** Durée de la fenêtre en ms */
  windowMs: number;
}

const buckets = new Map<string, Bucket>();

// Garbage collect : supprime les buckets vieux > 1h pour éviter memory leak
const GC_INTERVAL_MS = 60 * 60 * 1000;
let lastGc = Date.now();

function gcIfNeeded() {
  const now = Date.now();
  if (now - lastGc < GC_INTERVAL_MS) return;
  buckets.forEach((bucket, key) => {
    const fresh = bucket.hits.filter((t) => now - t < GC_INTERVAL_MS);
    if (fresh.length === 0) {
      buckets.delete(key);
    } else {
      bucket.hits = fresh;
    }
  });
  lastGc = now;
}

/**
 * Vérifie + enregistre un hit. Retourne `{ allowed, remaining, resetMs }`.
 *
 * @param key Identifiant unique (ex: `auth:register:<ip>`)
 * @param opts max requêtes / fenêtre ms
 */
export function checkRateLimit(
  key: string,
  opts: RateLimitOptions
): { allowed: boolean; remaining: number; resetMs: number } {
  gcIfNeeded();
  const now = Date.now();
  const windowStart = now - opts.windowMs;

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { hits: [] };
    buckets.set(key, bucket);
  }
  // Sliding window : ne garde que les hits dans la fenêtre
  bucket.hits = bucket.hits.filter((t) => t > windowStart);

  if (bucket.hits.length >= opts.max) {
    const oldest = bucket.hits[0];
    const resetMs = oldest + opts.windowMs - now;
    return { allowed: false, remaining: 0, resetMs };
  }

  bucket.hits.push(now);
  return {
    allowed: true,
    remaining: opts.max - bucket.hits.length,
    resetMs: opts.windowMs,
  };
}

/**
 * Extrait l'IP du client depuis une requête Next.js (headers Vercel/x-forwarded-for).
 * Fallback "anonymous" si aucun header présent.
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "anonymous";
}

/**
 * Reset complet du store interne. **Usage tests uniquement** (sinon
 * supprime le rate limit en runtime).
 */
export function __resetRateLimitForTests(): void {
  buckets.clear();
  lastGc = Date.now();
}

/**
 * Helper haut-niveau : 1 ligne dans une route handler.
 * Retourne `null` si autorisé, ou une `Response` 429 si bloqué.
 */
export function rateLimitOrFail(
  req: Request,
  scope: string,
  opts: RateLimitOptions
): Response | null {
  const ip = getClientIp(req);
  const result = checkRateLimit(`${scope}:${ip}`, opts);
  if (result.allowed) return null;
  return new Response(
    JSON.stringify({
      error: "Trop de tentatives, réessayez plus tard.",
      retryAfterSeconds: Math.ceil(result.resetMs / 1000),
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(Math.ceil(result.resetMs / 1000)),
      },
    }
  );
}
