"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

export function QuickActions() {
  const [syncing, setSyncing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  async function handleSync() {
    try {
      setSyncing(true);
      const response = await fetch("/api/gmail/sync");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Échec de la synchronisation");
      }

      toast.success(data.message || "Emails synchronisés");

      // Analyser automatiquement après le sync
      await handleAnalyze();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Échec de la synchronisation"
      );
    } finally {
      setSyncing(false);
    }
  }

  async function handleAnalyze() {
    try {
      setAnalyzing(true);
      const response = await fetch("/api/gmail/analyze", {
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Échec de l'analyse");
      }

      toast.success(
        `${data.extractedActions || 0} action(s) extraite(s) depuis ${data.processedEmails || 0} email(s)`
      );

      // Rafraîchir la page pour afficher les nouvelles actions
      window.location.reload();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Échec de l'analyse"
      );
    } finally {
      setAnalyzing(false);
    }
  }

  const isLoading = syncing || analyzing;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actions rapides</CardTitle>
        <CardDescription>
          Synchroniser et analyser vos emails manuellement
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          onClick={handleSync}
          disabled={isLoading}
          className="w-full"
        >
          {syncing ? (
            <>
              <RefreshCw className="mr-2 size-4 animate-spin" />
              Synchronisation...
            </>
          ) : analyzing ? (
            <>
              <RefreshCw className="mr-2 size-4 animate-spin" />
              Analyse en cours...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 size-4" />
              Synchroniser et analyser maintenant
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
