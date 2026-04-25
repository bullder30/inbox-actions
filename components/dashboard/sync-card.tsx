"use client";

import { RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { syncGmail, analyzeGmail } from "@/lib/api/email";
import { toast } from "sonner";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface SyncCardProps {
  lastSyncText: string;
}

export function SyncCard({ lastSyncText }: SyncCardProps) {
  const [syncing, setSyncing] = useState(false);
  const router = useRouter();

  async function handleSync() {
    setSyncing(true);

    const promise = (async () => {
      const syncResult = await syncGmail();
      if (syncResult.count === 0) {
        return { emails: 0, actions: 0 };
      }
      const analyzeResult = await analyzeGmail();
      return {
        emails: syncResult.count,
        actions: analyzeResult.extractedActions,
      };
    })();

    toast.promise(promise, {
      loading: "Synchronisation en cours…",
      success: ({ emails, actions }) => {
        if (emails === 0) return "Aucun nouvel email à extraire";
        return `${emails} email${emails > 1 ? "s" : ""} synchronisé${emails > 1 ? "s" : ""} • ${actions} action${actions > 1 ? "s" : ""} créée${actions > 1 ? "s" : ""}`;
      },
      error: (err) => err instanceof Error ? err.message : "Erreur lors de la synchronisation",
    });

    try {
      await promise;
      router.refresh();
    } catch {
      // Erreur déjà signalée par toast.promise
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Synchronisation</CardTitle>
        <RefreshCw className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">
          Dernière synchro : {lastSyncText}
        </p>
        <div className="mt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={syncing}
            className="w-full gap-2"
          >
            <RefreshCw className={`size-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Synchronisation..." : "Lancer une synchronisation"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
