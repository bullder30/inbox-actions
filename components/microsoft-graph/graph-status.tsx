"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Calendar,
  RefreshCw,
  Zap,
  Mail,
  ExternalLink,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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

interface GraphStatusData {
  configured: boolean;
  hasMailReadScope: boolean;
  hasAccount?: boolean;
  isConnected?: boolean;
  isActiveProvider?: boolean;
  email?: string;
  lastSync?: string;
  hasDeltaLink?: boolean;
  stats?: {
    totalEmails: number;
    pendingAnalysis: number;
  };
  message?: string;
}

interface GraphStatusProps {
  onStatusChange?: () => void;
  showTitle?: boolean;
}

export function GraphStatus({ onStatusChange, showTitle = false }: GraphStatusProps) {
  const [status, setStatus] = useState<GraphStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  async function loadStatus() {
    try {
      setLoading(true);
      const response = await fetch("/api/microsoft-graph/status");
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error("[Graph Status] Error:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleActivate() {
    setActivating(true);
    try {
      const response = await fetch("/api/microsoft-graph/activate", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || "Activation failed");
      }

      toast.success("Microsoft Graph API activé !");
      loadStatus();
      onStatusChange?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Activation error");
    } finally {
      setActivating(false);
    }
  }

  async function handleConnect() {
    setConnecting(true);
    try {
      const response = await fetch("/api/microsoft-graph/connect");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to initiate connection");
      }

      // Redirect to Microsoft OAuth
      window.location.href = data.authUrl;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Connection error");
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      const response = await fetch("/api/microsoft-graph/disconnect", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Disconnection failed");
      }

      toast.success("Microsoft Graph déconnecté");
      loadStatus();
      onStatusChange?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Disconnection error");
    } finally {
      setDisconnecting(false);
    }
  }

  useEffect(() => {
    loadStatus();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        {showTitle && (
          <div className="flex items-center gap-2">
            <Skeleton className="size-5 rounded" />
            <Skeleton className="h-5 w-36" />
          </div>
        )}
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="size-4 rounded" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="size-9" />
        </div>
      </div>
    );
  }

  // Case 1: No Microsoft account AND no Mail.Read scope - Show connect button
  if (!status?.hasAccount || (!status?.hasMailReadScope && !status?.configured)) {
    return (
      <div className="space-y-4">
        {showTitle && (
          <div className="flex items-center gap-2">
            <Zap className="size-5 text-blue-500" />
            <h3 className="font-medium">Microsoft Graph API</h3>
          </div>
        )}
        <p className="text-sm text-muted-foreground">
          Connectez votre compte Microsoft pour synchroniser vos emails Outlook, Hotmail ou Microsoft 365.
        </p>
        <Button
          onClick={handleConnect}
          disabled={connecting}
          variant="outline"
          className="gap-2"
        >
          {connecting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Connexion...
            </>
          ) : (
            <>
              <Mail className="size-4" />
              Connecter un compte Microsoft
              <ExternalLink className="size-3" />
            </>
          )}
        </Button>
      </div>
    );
  }

  // Case 2: Account exists but no Mail.Read scope - Show re-connect button
  if (status?.hasAccount && !status?.hasMailReadScope) {
    return (
      <div className="space-y-4">
        {showTitle && (
          <div className="flex items-center gap-2">
            <Zap className="size-5 text-yellow-500" />
            <h3 className="font-medium">Microsoft Graph API</h3>
          </div>
        )}
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-3 dark:border-yellow-800 dark:bg-yellow-950">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            Votre compte Microsoft est connecté mais la permission de lecture des emails n&apos;a pas été accordée.
          </p>
        </div>
        <Button
          onClick={handleConnect}
          disabled={connecting}
          variant="outline"
          className="gap-2"
        >
          {connecting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Connexion...
            </>
          ) : (
            <>
              <RefreshCw className="size-4" />
              Reconnecter avec permission email
              <ExternalLink className="size-3" />
            </>
          )}
        </Button>
      </div>
    );
  }

  // Case 3: Configured with Mail.Read scope - Show status and controls
  return (
    <div className="space-y-4">
      {showTitle && (
        <div className="flex items-center gap-2">
          <Zap className="size-5 text-green-500" />
          <h3 className="font-medium">Microsoft Graph API</h3>
        </div>
      )}

      {/* Status badges */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant={status?.isConnected ? "gradient" : "destructive"}
          className="gap-1"
        >
          {status?.isConnected ? (
            <>
              <CheckCircle2 className="size-3" />
              Connecté
            </>
          ) : (
            <>
              <XCircle className="size-3" />
              Token expiré
            </>
          )}
        </Badge>
        {status?.email && (
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <Mail className="size-3" />
            {status.email}
          </span>
        )}
      </div>

      {/* Stats */}
      {status?.stats && (
        <div className="flex gap-4 text-sm">
          <div>
            <span className="font-medium">{status.stats.totalEmails}</span>
            <span className="text-muted-foreground"> emails synchronisés</span>
          </div>
          {status.stats.pendingAnalysis > 0 && (
            <div>
              <span className="font-medium">{status.stats.pendingAnalysis}</span>
              <span className="text-muted-foreground"> en attente d&apos;analyse</span>
            </div>
          )}
        </div>
      )}

      {/* Last sync */}
      {status?.lastSync && (
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="size-4 text-muted-foreground" />
          <span className="text-muted-foreground">
            Dernière sync :{" "}
            {formatDistanceToNow(new Date(status.lastSync), {
              locale: fr,
              addSuffix: true,
            })}
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {/* Not active provider - show activate button */}
        {!status?.isActiveProvider && (
          <Button
            onClick={handleActivate}
            disabled={activating}
            variant="default"
          >
            {activating ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Activation...
              </>
            ) : (
              <>
                <Zap className="mr-2 size-4" />
                Utiliser Microsoft Graph
              </>
            )}
          </Button>
        )}

        {/* Token expired - show reconnect button */}
        {!status?.isConnected && (
          <Button
            onClick={handleConnect}
            disabled={connecting}
            variant="outline"
            className="gap-2"
          >
            {connecting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Connexion...
              </>
            ) : (
              <>
                <RefreshCw className="size-4" />
                Reconnecter
              </>
            )}
          </Button>
        )}

        {/* Disconnect button */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="icon" className="text-destructive hover:bg-destructive/10">
              <Trash2 className="size-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Déconnecter Microsoft Graph ?</AlertDialogTitle>
              <AlertDialogDescription>
                Cette action supprimera l&apos;accès aux emails Microsoft.
                Les emails déjà synchronisés et les actions extraites seront conservés.
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

      {/* Migration hint for non-active provider */}
      {!status?.isActiveProvider && status?.configured && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Recommandé :</strong> Passez à Microsoft Graph API pour une meilleure expérience.
            Aucune configuration IMAP nécessaire, rafraîchissement automatique des tokens et sync plus rapide.
          </p>
        </div>
      )}
    </div>
  );
}
