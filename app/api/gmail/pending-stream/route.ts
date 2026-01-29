import { auth } from "@/auth";
import { createEmailProvider } from "@/lib/email-provider/factory";

export const dynamic = "force-dynamic";

/**
 * GET /api/gmail/pending-stream
 * Server-Sent Events (SSE) endpoint pour streamer le count d'emails en attente en temps réel
 *
 * Envoie un événement toutes les 30 secondes avec le count actuel
 */
export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = session.user.id;

  // Variable pour stocker l'intervalle dans la closure
  let intervalId: NodeJS.Timeout | null = null;

  // Créer un ReadableStream pour SSE
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let isClosed = false;

      // Fonction pour envoyer un événement SSE
      const sendEvent = (data: { count: number }) => {
        // Vérifier si le stream est toujours actif
        if (isClosed) {
          return;
        }

        try {
          const message = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        } catch (error) {
          // Si enqueue échoue, c'est que le stream est fermé
          console.log("[SSE] Stream already closed, stopping sends");
          isClosed = true;
        }
      };

      // Fonction pour récupérer et envoyer le count
      const fetchAndSendCount = async () => {
        if (isClosed) {
          return;
        }

        try {
          const emailProvider = await createEmailProvider(userId);

          if (!emailProvider) {
            sendEvent({ count: 0 });
            return;
          }

          const count = await emailProvider.countNewEmails();
          sendEvent({ count });
        } catch (error) {
          console.error("[SSE] Error fetching pending count:", error);
          sendEvent({ count: 0 });
        }
      };

      // Envoyer immédiatement le count au démarrage
      await fetchAndSendCount();

      // Puis envoyer toutes les 30 secondes
      intervalId = setInterval(async () => {
        await fetchAndSendCount();
      }, 30 * 1000); // 30 secondes
    },
    cancel() {
      // Cleanup quand le client se déconnecte
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        console.log("[SSE] Stream cancelled, interval cleared");
      }
    },
  });

  // Retourner la réponse SSE
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
