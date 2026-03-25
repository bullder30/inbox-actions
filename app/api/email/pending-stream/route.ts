import { auth } from "@/auth";
import { createAllEmailProviders } from "@/lib/email-provider/factory";
import type { IEmailProvider } from "@/lib/email-provider/interface";

export const dynamic = "force-dynamic";

const POLL_INTERVAL_MS = 120 * 1000; // 120 secondes
const PROVIDER_CACHE_TTL_MS = 10 * 60 * 1000; // Recrée les providers toutes les 10 min
const MAX_CONCURRENT_CONNECTIONS = 50;

// Compteur module-level (efficace en mode Node.js persistant ; best-effort en serverless)
let activeConnections = 0;

/**
 * GET /api/email/pending-stream
 * Server-Sent Events (SSE) endpoint pour streamer le count d'emails en attente en temps réel
 *
 * Envoie un événement toutes les 120 secondes avec le count actuel.
 * Les providers email sont mis en cache pour la durée de la connexion SSE
 * (recréés toutes les 10 min pour absorber les rotations de tokens).
 */
export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (activeConnections >= MAX_CONCURRENT_CONNECTIONS) {
    return new Response("Too Many Connections", { status: 503 });
  }

  activeConnections++;
  const userId = session.user.id;

  let intervalId: NodeJS.Timeout | null = null;

  // Cache des providers pour la durée de la connexion SSE
  let cachedProviders: IEmailProvider[] | null = null;
  let cacheExpiry = 0;

  const getProviders = async (): Promise<IEmailProvider[]> => {
    if (cachedProviders !== null && Date.now() < cacheExpiry) {
      return cachedProviders;
    }
    cachedProviders = await createAllEmailProviders(userId);
    cacheExpiry = Date.now() + PROVIDER_CACHE_TTL_MS;
    return cachedProviders;
  };

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let isClosed = false;

      const sendEvent = (data: { count: number }) => {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          console.log("[SSE] Stream already closed, stopping sends");
          isClosed = true;
        }
      };

      const fetchAndSendCount = async () => {
        if (isClosed) return;
        try {
          const providers = await getProviders();
          if (providers.length === 0) {
            sendEvent({ count: 0 });
            return;
          }
          let count = 0;
          for (const provider of providers) {
            count += await provider.countNewEmails();
          }
          sendEvent({ count });
        } catch (error) {
          console.error("[SSE] Error fetching pending count:", error);
          // Invalider le cache pour forcer une reconnexion au prochain poll
          cachedProviders = null;
          sendEvent({ count: 0 });
        }
      };

      // Envoyer immédiatement le count au démarrage
      await fetchAndSendCount();

      // Puis envoyer toutes les 120 secondes
      intervalId = setInterval(fetchAndSendCount, POLL_INTERVAL_MS);
    },
    cancel() {
      // Cleanup quand le client se déconnecte
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      cachedProviders = null;
      activeConnections = Math.max(0, activeConnections - 1);
      console.log("[SSE] Stream cancelled, interval cleared");
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
