"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Mail,
  Calendar,
  Server,
  RefreshCw,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface IMAPStatusData {
  configured: boolean;
  host?: string;
  username?: string;
  folder?: string;
  isConnected?: boolean;
  lastSync?: string;
  lastError?: string;
  lastErrorAt?: string;
  emailCount?: number;
  pendingCount?: number;
  createdAt?: string;
  message?: string;
}

interface IMAPStatusProps {
  onDisconnect?: () => void;
}

export function IMAPStatus({ onDisconnect }: IMAPStatusProps) {
  const [status, setStatus] = useState<IMAPStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  async function loadStatus() {
    try {
      setLoading(true);
      const response = await fetch("/api/imap/status");
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error("[IMAP Status] Error:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const response = await fetch("/api/imap/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxResults: 100 }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Échec de la synchronisation");
      }

      toast.success(`${data.count} email(s) synchronisé(s)`);
      loadStatus(); // Rafraîchir le statut
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erreur de synchronisation"
      );
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      const response = await fetch("/api/imap/disconnect", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Échec de la déconnexion");
      }

      toast.success("Connexion IMAP supprimée");
      onDisconnect?.();
      loadStatus();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erreur de déconnexion"
      );
    } finally {
      setDisconnecting(false);
    }
  }

  useEffect(() => {
    loadStatus();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!status?.configured) {
    return null; // Pas de credentials IMAP configurées
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server className="size-5" />
          Connexion IMAP
        </CardTitle>
        <CardDescription>
          {status.username} sur {status.host}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Statut de connexion */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Statut</span>
          <Badge
            variant={status.isConnected ? "gradient" : "destructive"}
            className="gap-1"
          >
            {status.isConnected ? (
              <>
                <CheckCircle2 className="size-3" />
                Connecté
              </>
            ) : (
              <>
                <XCircle className="size-3" />
                Déconnecté
              </>
            )}
          </Badge>
        </div>

        {/* Dossier synchronisé */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Dossier</span>
          <span className="text-sm text-muted-foreground">{status.folder}</span>
        </div>

        {/* Erreur de connexion */}
        {status.lastError && (
          <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 p-3">
            <AlertCircle className="size-4 shrink-0 text-red-600" />
            <div>
              <p className="text-sm font-medium text-red-800">
                Erreur de connexion
              </p>
              <p className="text-xs text-red-700">{status.lastError}</p>
            </div>
          </div>
        )}

        {/* Dernière synchronisation */}
        {status.lastSync && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Dernière synchronisation</span>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Calendar className="size-3" />
              <span>
                {formatDistanceToNow(new Date(status.lastSync), {
                  locale: fr,
                  addSuffix: true,
                })}
              </span>
            </div>
          </div>
        )}

        {/* Statistiques */}
        <div className="grid gap-4 pt-2 sm:grid-cols-2">
          <div className="rounded-lg border bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">Emails synchronisés</p>
            <p className="text-2xl font-bold">{status.emailCount || 0}</p>
          </div>
          <div className="rounded-lg border bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">En attente d&apos;analyse</p>
            <p className="text-2xl font-bold">{status.pendingCount || 0}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            onClick={handleSync}
            disabled={syncing}
            className="flex-1"
          >
            {syncing ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Synchronisation...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 size-4" />
                Synchroniser
              </>
            )}
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="icon">
                <Trash2 className="size-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Déconnecter IMAP ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action supprimera vos credentials IMAP. Les emails déjà
                  synchronisés et les actions extraites seront conservés.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {disconnecting ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 size-4" />
                  )}
                  Déconnecter
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
