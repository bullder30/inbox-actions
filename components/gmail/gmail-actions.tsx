"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, LogOut, RefreshCw, Search } from "lucide-react";
import { analyzeGmail, disconnectGmail, syncGmail } from "@/lib/api/gmail";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useState } from "react";

interface GmailActionsProps {
  onStatusChange?: () => void;
  extractedCount?: number;
}

export function GmailActions({ onStatusChange, extractedCount = 0 }: GmailActionsProps) {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);

  async function handleSync() {
    try {
      setSyncing(true);
      const result = await syncGmail({ maxResults: 100 });
      toast.success(result.message);
      onStatusChange?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erreur de synchronisation"
      );
    } finally {
      setSyncing(false);
    }
  }

  async function handleAnalyze() {
    try {
      setAnalyzing(true);
      const result = await analyzeGmail({ maxEmails: 50 });
      toast.success(result.message);
      onStatusChange?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erreur d'analyse"
      );
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleDisconnect() {
    try {
      setLoading(true);
      const result = await disconnectGmail();
      toast.success(result.message);
      setDisconnectDialogOpen(false);
      onStatusChange?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erreur de déconnexion"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
          <CardDescription>
            Gérez la synchronisation de votre compte Gmail
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button
              onClick={handleSync}
              disabled={syncing}
              variant="outline"
              className="gap-2"
            >
              {syncing ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Synchronisation...
                </>
              ) : (
                <>
                  <RefreshCw className="size-4" />
                  Synchroniser
                </>
              )}
            </Button>
            {extractedCount > 0 && (
              <Button
                onClick={handleAnalyze}
                disabled={analyzing}
                variant="default"
                className="gap-2"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Analyse...
                  </>
                ) : (
                  <>
                    <Search className="size-4" />
                    Analyser ({extractedCount})
                  </>
                )}
              </Button>
            )}
            <Button
              onClick={() => setDisconnectDialogOpen(true)}
              disabled={loading}
              variant="destructive"
              className="gap-2"
            >
              <LogOut className="size-4" />
              Déconnecter
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog
        open={disconnectDialogOpen}
        onOpenChange={setDisconnectDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Déconnecter Gmail</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir déconnecter votre compte Gmail ? Toutes
              les métadonnées d&apos;emails stockées seront supprimées de manière
              permanente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnect}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Déconnexion...
                </>
              ) : (
                "Déconnecter"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
