"use client";

import { Inbox, RefreshCw } from "lucide-react";
import { StatsCard } from "@/components/dashboard/stats-card";
import { Button } from "@/components/ui/button";
import { syncGmail, analyzeGmail } from "@/lib/api/gmail";
import { toast } from "sonner";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePendingEmailsStore } from "@/lib/stores/pending-emails-store";

interface PendingSyncCardProps {
  lastSyncText: string;
}

export function PendingSyncCard({ lastSyncText }: PendingSyncCardProps) {
  // Utiliser le store Zustand (mis à jour en temps réel via SSE)
  const count = usePendingEmailsStore((state) => state.count);
  const [syncing, setSyncing] = useState(false);
  const router = useRouter();

  async function handleSync() {
    try {
      setSyncing(true);

      // Étape 1 : Extraction de TOUS les emails depuis la dernière synchro
      toast.info("Extraction des emails en cours...");
      const syncResult = await syncGmail(); // Pas de limite, récupère tous les nouveaux emails

      if (syncResult.count === 0) {
        toast.info("Aucun nouvel email à extraire");
        return;
      }

      toast.success(`${syncResult.count} email(s) extrait(s)`);

      // Étape 2 : Analyse de TOUS les emails extraits pour créer les actions
      toast.info("Analyse des emails en cours...");
      const analyzeResult = await analyzeGmail(); // Pas de limite, analyse tous les emails EXTRACTED
      toast.success(
        `${analyzeResult.extractedActions} action(s) créée(s) à partir de ${analyzeResult.processedEmails} email(s)`
      );

      router.refresh();
      // Le count sera automatiquement mis à jour via SSE
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erreur lors de l'analyse"
      );
    } finally {
      setSyncing(false);
    }
  }

  const syncButton = count > 0 ? (
    <Button
      variant="outline"
      size="sm"
      onClick={handleSync}
      disabled={syncing}
      className="gap-2"
    >
      <RefreshCw className={`size-4 ${syncing ? "animate-spin" : ""}`} />
      Analyser
    </Button>
  ) : undefined;

  return (
    <StatsCard
      title="En attente"
      value={count}
      description={
        count > 0
          ? `Nouveaux emails depuis ${lastSyncText}`
          : `Dernière synchro ${lastSyncText}`
      }
      icon={Inbox}
      action={syncButton}
    />
  );
}
