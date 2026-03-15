"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Calendar,
  Server,
  Trash2,
  Pencil,
} from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { Loader2 } from "lucide-react";
import { IMAPConnectForm } from "./imap-connect-form";

export interface IMAPMailboxData {
  id: string;
  label: string | null;
  host: string;
  port: number;
  username: string;
  folder: string;
  useTLS: boolean;
  isConnected: boolean;
  lastSync: string | null;
  lastError: string | null;
  lastErrorAt: string | null;
}

interface IMAPMailboxCardProps {
  mailbox: IMAPMailboxData;
  onDisconnect: (credentialId: string) => void;
  onUpdate: () => void;
}

export function IMAPMailboxCard({ mailbox, onDisconnect, onUpdate }: IMAPMailboxCardProps) {
  const [disconnecting, setDisconnecting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const displayName = mailbox.label || mailbox.username;

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      const response = await fetch("/api/imap/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credentialId: mailbox.id }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Échec de la déconnexion");

      toast.success(`Boîte "${displayName}" supprimée`);
      onDisconnect(mailbox.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur de déconnexion");
    } finally {
      setDisconnecting(false);
    }
  }

  if (isEditing) {
    return (
      <div className="rounded-lg border p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium">Modifier : {displayName}</span>
          <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
            Annuler
          </Button>
        </div>
        <IMAPConnectForm
          onSuccess={() => {
            setIsEditing(false);
            onUpdate();
          }}
        />
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-3 sm:p-4">
      {/* Ligne 1 : nom + boutons */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Server className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate font-medium">{displayName}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon" className="size-8" onClick={() => setIsEditing(true)}>
            <Pencil className="size-3.5" />
          </Button>
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

      {/* Ligne 2 : statut + détails */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <Badge variant={mailbox.isConnected ? "success" : "destructive"} className="gap-1 text-xs">
          {mailbox.isConnected ? (
            <><CheckCircle2 className="size-3" /> Connecté</>
          ) : (
            <><XCircle className="size-3" /> Déconnecté</>
          )}
        </Badge>
        <span className="text-xs text-muted-foreground">{mailbox.username} · {mailbox.host}</span>
        {mailbox.lastSync && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="size-3" />
            {formatDistanceToNow(new Date(mailbox.lastSync), { locale: fr, addSuffix: true })}
          </span>
        )}
      </div>

      {/* Erreur */}
      {mailbox.lastError && (
        <div className="mt-2 flex items-start gap-1.5 rounded-md border border-red-200 bg-red-50 p-2 dark:border-red-800 dark:bg-red-950">
          <AlertCircle className="mt-0.5 size-3 shrink-0 text-red-600 dark:text-red-400" />
          <p className="text-xs text-red-700 dark:text-red-300">{mailbox.lastError}</p>
        </div>
      )}
    </div>
  );
}
