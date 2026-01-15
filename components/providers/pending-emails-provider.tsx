"use client";

import { usePendingEmailsStore } from "@/lib/stores/pending-emails-store";
import { useEffect } from "react";

/**
 * Provider qui écoute les événements SSE pour mettre à jour le store Zustand
 * en temps réel avec le nombre d'emails en attente
 */
export function PendingEmailsProvider({ children }: { children: React.ReactNode }) {
  const setCount = usePendingEmailsStore((state) => state.setCount);

  useEffect(() => {
    // Créer la connexion EventSource pour SSE
    const eventSource = new EventSource("/api/gmail/pending-stream");

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (typeof data.count === "number") {
          setCount(data.count);
        }
      } catch (error) {
        console.error("[SSE] Error parsing event data:", error);
      }
    };

    eventSource.onerror = (error) => {
      console.error("[SSE] EventSource error:", error);
      // EventSource se reconnecte automatiquement
    };

    // Cleanup à la déconnexion
    return () => {
      eventSource.close();
    };
  }, [setCount]);

  return <>{children}</>;
}
