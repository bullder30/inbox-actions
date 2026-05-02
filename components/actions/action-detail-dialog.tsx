"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Check, X, Calendar, Mail, Clock, MailOpen } from "lucide-react";

import {
  ActionWithUser,
  ActionWithUserPrisma,
  markActionAsDone,
  markActionAsIgnored,
} from "@/lib/api/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn, decodeHtmlEntities } from "@/lib/utils";
import { toast } from "sonner";
import { getActionTypeDisplay } from "@/lib/actions/action-display";

const actionStatusLabels = {
  TODO: { label: "À faire", color: "bg-slate-100 text-slate-800" },
  DONE: { label: "Terminé", color: "bg-green-100 text-green-800" },
  IGNORED: { label: "Ignoré", color: "bg-gray-100 text-gray-800" },
};

interface ActionDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: ActionWithUser | ActionWithUserPrisma;
  onUpdate?: (newStatus?: "DONE" | "IGNORED" | "SCHEDULED" | "TODO") => void;
}

export function ActionDetailDialog({
  open,
  onOpenChange,
  action,
  onUpdate,
}: ActionDetailDialogProps) {
  const [actionLoading, setActionLoading] = useState(false);

  const typeDisplay = getActionTypeDisplay({
    type: action.type,
    customTypeLabel: action.customTypeLabel,
    customTypeColor: action.customTypeColor,
  });
  const statusInfo = actionStatusLabels[action.status];

  const isUrgent =
    action.dueDate &&
    new Date(action.dueDate) < new Date(Date.now() + 24 * 60 * 60 * 1000) &&
    action.status === "TODO";

  const isOverdue =
    action.dueDate &&
    new Date(action.dueDate) < new Date() &&
    action.status === "TODO";

  const displaySender = (() => {
    const match = action.emailFrom.match(/<([^>]+)>/);
    return (match ? match[1] : action.emailFrom).trim();
  })();

  async function handleMarkDone() {
    try {
      setActionLoading(true);
      await markActionAsDone(action.id);
      toast.success("Action marquée comme terminée");
      onUpdate?.("DONE");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleMarkIgnored() {
    try {
      setActionLoading(true);
      await markActionAsIgnored(action.id);
      toast.success("Action marquée comme ignorée");
      onUpdate?.("IGNORED");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto p-0 sm:max-w-2xl">
        <DialogHeader
          className={cn(
            "space-y-3 border-b p-4 sm:p-6",
            isOverdue && "border-red-300 bg-red-50/50",
            isUrgent && !isOverdue && "border-orange-300 bg-orange-50/50"
          )}
        >
          {/* Badges sur leur propre rangee — labels custom longs ne debordent pas */}
          <div className="flex flex-wrap items-center gap-1.5 pr-8">
            <Badge
              variant="outline"
              className={cn(typeDisplay.badgeClasses, "max-w-full break-words text-xs")}
            >
              {typeDisplay.label}
            </Badge>
            <Badge variant="secondary" className={cn(statusInfo.color, "text-xs")}>
              {statusInfo.label}
            </Badge>
          </div>

          <DialogTitle className="break-words text-left text-xl leading-snug sm:text-2xl">
            {decodeHtmlEntities(action.title)}
          </DialogTitle>

          <DialogDescription
            asChild
            className="flex flex-wrap items-center gap-x-3 gap-y-1 text-left text-sm"
          >
            <div>
              <span className="flex min-w-0 items-center gap-1.5">
                <Mail className="size-4 shrink-0" />
                <span className="break-all">{displaySender}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="size-4 shrink-0" />
                <span>
                  Reçu{" "}
                  {formatDistanceToNow(new Date(action.emailReceivedAt), {
                    locale: fr,
                    addSuffix: true,
                  })}
                </span>
              </span>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 p-4 sm:p-6">
          {/* Phrase source */}
          <div>
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">
              Phrase source
            </h3>
            <div className="rounded-lg border bg-muted/50 p-4">
              <div className="flex items-start justify-between gap-2 sm:gap-4">
                <p className="min-w-0 flex-1 break-words text-sm italic">
                  &ldquo;{decodeHtmlEntities(action.sourceSentence)}&rdquo;
                </p>
                {action.emailWebUrl && (
                  <a
                    href={action.emailWebUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Ouvrir l'email source"
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      className="size-9 shrink-0 p-0 sm:size-auto sm:gap-2 sm:px-3"
                    >
                      <MailOpen className="size-4" />
                      <span className="hidden sm:inline">Voir email</span>
                    </Button>
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Échéance */}
          {action.dueDate && (
            <div>
              <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                Échéance
              </h3>
              <div
                className={cn(
                  "flex items-center gap-2 rounded-lg border p-3",
                  isOverdue
                    ? "border-red-300 bg-red-50 text-red-800"
                    : isUrgent
                    ? "border-orange-300 bg-orange-50 text-orange-800"
                    : "border-slate-300 bg-slate-50 text-slate-800"
                )}
              >
                <Calendar className="size-4 shrink-0" />
                <span className="text-sm font-medium">
                  {isOverdue ? "⚠️ En retard" : isUrgent ? "⏰ Urgent" : ""}{" "}
                  {new Date(action.dueDate).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          )}

          {/* Métadonnées */}
          <div className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <span className="text-muted-foreground">Date du mail</span>
              <p className="font-medium">
                {new Date(action.emailReceivedAt).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Créée le</span>
              <p className="font-medium">
                {new Date(action.createdAt).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            {action.status !== "TODO" && (
              <div>
                <span className="text-muted-foreground">Traité le</span>
                <p className="font-medium">
                  {new Date(action.updatedAt).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="border-t p-4 sm:p-6">
          {action.status === "TODO" ? (
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                onClick={handleMarkDone}
                disabled={actionLoading}
                className="h-11 w-full sm:h-10 sm:w-auto"
              >
                <Check className="mr-2 size-4" />
                Marquer comme fait
              </Button>
              <Button
                onClick={handleMarkIgnored}
                disabled={actionLoading}
                variant="outline"
                className="h-11 w-full sm:h-10 sm:w-auto"
              >
                <X className="mr-2 size-4" />
                Ignorer
              </Button>
            </div>
          ) : (
            <div className="flex w-full flex-col items-center gap-3 sm:flex-row sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Cette action est{" "}
                {action.status === "DONE" ? "terminée" : "ignorée"}
              </p>
              <DialogClose asChild>
                <Button variant="outline" className="h-11 w-full sm:h-10 sm:w-auto">
                  Fermer
                </Button>
              </DialogClose>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
