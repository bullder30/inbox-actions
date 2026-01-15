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
import { Loader2, LogOut, Mail, RefreshCw } from "lucide-react";
import { disconnectGmail, syncGmail } from "@/lib/api/gmail";

import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState } from "react";

interface GmailConnectButtonProps {
  connected: boolean;
  onStatusChange?: () => void;
}

export function GmailConnectButton({
  connected,
  onStatusChange,
}: GmailConnectButtonProps) {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);

  async function handleConnect() {
    // Rediriger vers l'authentification Google
    window.location.href = "/api/auth/signin/google?callbackUrl=/settings";
  }

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

  if (!connected) {
    return (
      <Button onClick={handleConnect} className="gap-2">
        <Mail className="size-4" />
        Connecter Gmail
      </Button>
    );
  }

  return (
    <>
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
