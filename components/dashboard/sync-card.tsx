"use client";

import { RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { syncGmail, analyzeGmail } from "@/lib/api/gmail";
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
    try {
      setSyncing(true);

      // Étape 1 : Extraction des emails depuis la dernière synchro
      toast.info("Extraction des emails en cours...");
      const syncResult = await syncGmail();

      if (syncResult.count === 0) {
        toast.info("Aucun nouvel email à extraire");
        return;
      }

      toast.success(`${syncResult.count} email(s) extrait(s)`);

      // Étape 2 : Analyse des emails pour créer les actions
      toast.info("Analyse des emails en cours...");
      const analyzeResult = await analyzeGmail();
      toast.success(
        `${analyzeResult.extractedActions} action(s) créée(s) à partir de ${analyzeResult.processedEmails} email(s)`
      );

      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erreur lors de la synchronisation"
      );
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
