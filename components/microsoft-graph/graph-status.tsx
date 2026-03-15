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
  Calendar,
  Zap,
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

interface GraphMailboxData {
  id: string;
  label: string | null;
  email: string | null;
  isConnected: boolean;
  connectionError: string | null;
  lastSync: string | null;
}

interface GraphStatusProps {
  onStatusChange?: () => void;
}

function GraphMailboxCard({
  mailbox,
  onRemove,
}: {
  mailbox: GraphMailboxData;
  onRemove: (id: string) => void;
}) {
  const [disconnecting, setDisconnecting] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const displayName = mailbox.label || mailbox.email || "Microsoft";

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      const response = await fetch("/api/microsoft-graph/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mailboxId: mailbox.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Échec de la déconnexion");
      toast.success(`Boîte "${displayName}" supprimée`);
      onRemove(mailbox.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur de déconnexion");
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleReconnect() {
    setConnecting(true);
    try {
      const response = await fetch("/api/microsoft-graph/connect");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to initiate connection");
      window.location.href = data.authUrl;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Connection error");
      setConnecting(false);
    }
  }

  return (
    <div className="rounded-lg border p-3 sm:p-4">
      {/* Ligne 1 : badge + boutons */}
      <div className="flex items-center justify-between gap-2">
        <Badge variant={mailbox.isConnected ? "success" : "destructive"} className="gap-1 text-xs">
          {mailbox.isConnected ? (
            <><CheckCircle2 className="size-3" /> Connecté</>
          ) : (
            <><XCircle className="size-3" /> Token expiré</>
          )}
        </Badge>
        <div className="flex shrink-0 items-center gap-1">
          {!mailbox.isConnected && (
            <Button onClick={handleReconnect} disabled={connecting} variant="ghost" size="icon" className="size-8" title="Reconnecter">
              {connecting ? <Loader2 className="size-3.5 animate-spin" /> : <ExternalLink className="size-3.5" />}
            </Button>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8 text-destructive hover:bg-destructive/10">
                <Trash2 className="size-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer la boîte &quot;{displayName}&quot; ?</AlertDialogTitle>
                <AlertDialogDescription>
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
                  {disconnecting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Trash2 className="mr-2 size-4" />}
                  Supprimer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Ligne 2 : nom */}
      <div className="mt-1.5 flex items-center gap-2">
        <Zap className="size-4 shrink-0 text-muted-foreground" />
        <span className="break-words font-medium">{displayName}</span>
      </div>

      {/* Ligne 3 : email + sync */}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        {mailbox.email && (
          <span className="text-xs text-muted-foreground">{mailbox.email}</span>
        )}
        {mailbox.lastSync && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="size-3" />
            {formatDistanceToNow(new Date(mailbox.lastSync), { locale: fr, addSuffix: true })}
          </span>
        )}
      </div>

      {/* Erreur */}
      {mailbox.connectionError && (
        <div className="mt-2 flex items-start gap-1.5 rounded-md border border-red-200 bg-red-50 p-2 dark:border-red-800 dark:bg-red-950">
          <AlertCircle className="mt-0.5 size-3 shrink-0 text-red-600 dark:text-red-400" />
          <p className="text-xs text-red-700 dark:text-red-300">{mailbox.connectionError}</p>
        </div>
      )}
    </div>
  );
}

export function GraphStatus({ onStatusChange }: GraphStatusProps) {
  const [mailboxes, setMailboxes] = useState<GraphMailboxData[]>([]);
  const [microsoftOAuthEnabled, setMicrosoftOAuthEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  async function loadStatus() {
    try {
      setLoading(true);
      const response = await fetch("/api/microsoft-graph/status");
      const data = await response.json();
      setMicrosoftOAuthEnabled(data.microsoftOAuthEnabled ?? false);
      setMailboxes(data.mailboxes ?? []);
    } catch (error) {
      console.error("[GraphStatus] Error:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect() {
    setConnecting(true);
    try {
      const response = await fetch("/api/microsoft-graph/connect");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to initiate connection");
      window.location.href = data.authUrl;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Connection error");
      setConnecting(false);
    }
  }

  function handleRemoveMailbox(id: string) {
    setMailboxes((prev) => prev.filter((m) => m.id !== id));
    onStatusChange?.();
  }

  useEffect(() => {
    loadStatus();
  }, []);

  if (!microsoftOAuthEnabled && !loading) {
    return null;
  }

  if (loading) {
    return (
      <div className="rounded-lg border p-3 sm:p-4">
        {/* Ligne 1 : badge + boutons */}
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <div className="flex gap-1">
            <Skeleton className="size-8 rounded" />
          </div>
        </div>
        {/* Ligne 2 : icône + nom */}
        <div className="mt-1.5 flex items-center gap-2">
          <Skeleton className="size-4" />
          <Skeleton className="h-4 w-32" />
        </div>
        {/* Ligne 3 : détails */}
        <div className="mt-1.5 flex items-center gap-3">
          <Skeleton className="h-3 w-36" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Boîtes Microsoft Graph existantes */}
      {mailboxes.map((mailbox) => (
        <GraphMailboxCard
          key={mailbox.id}
          mailbox={mailbox}
          onRemove={handleRemoveMailbox}
        />
      ))}

      {/* Bouton Ajouter une boîte Microsoft */}
      <Button
        variant="outline"
        size="sm"
        className="w-full gap-2"
        onClick={handleConnect}
        disabled={connecting}
      >
        {connecting ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Connexion...
          </>
        ) : (
          <>
            <Zap className="size-4" />
            Ajouter une boîte Microsoft<span className="hidden sm:inline"> (Outlook, Hotmail, M365…)</span>
            <ExternalLink className="size-3" />
          </>
        )}
      </Button>
    </>
  );
}
