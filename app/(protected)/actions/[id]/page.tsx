"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { ActionWithUser } from "@/lib/api/actions";
import {
  markActionAsDone,
  markActionAsIgnored,
} from "@/lib/api/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Check,
  X,
  Calendar,
  Mail,
  Clock,
  MailOpen,
} from "lucide-react";
import { BackButton } from "@/components/shared/back-button";
import { cn, decodeHtmlEntities } from "@/lib/utils";
import { toast } from "sonner";
import { getActionTypeDisplay } from "@/lib/actions/action-display";

const actionStatusLabels = {
  TODO: { label: "À faire", color: "bg-slate-100 text-slate-800" },
  DONE: { label: "Terminé", color: "bg-green-100 text-green-800" },
  IGNORED: { label: "Ignoré", color: "bg-gray-100 text-gray-800" },
};

export default function ActionDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const [action, setAction] = useState<ActionWithUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const loadAction = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/actions/${params.id}`);
      if (!response.ok) {
        if (response.status === 404) {
          toast.error("Action introuvable");
          router.push("/actions");
          return;
        }
        throw new Error("Erreur de chargement");
      }
      const data = await response.json();
      setAction(data);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erreur de chargement"
      );
      router.push("/actions");
    } finally {
      setLoading(false);
    }
  }, [params.id, router]);

  useEffect(() => {
    loadAction();
  }, [loadAction]);

  async function handleMarkDone() {
    if (!action) return;
    const previous = action;
    setAction({ ...action, status: "DONE", updatedAt: new Date() });
    try {
      setActionLoading(true);
      await markActionAsDone(action.id);
      toast.success("Action marquée comme terminée");
    } catch (error) {
      setAction(previous);
      toast.error(error instanceof Error ? error.message : "Erreur");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleMarkIgnored() {
    if (!action) return;
    const previous = action;
    setAction({ ...action, status: "IGNORED", updatedAt: new Date() });
    try {
      setActionLoading(true);
      await markActionAsIgnored(action.id);
      toast.success("Action marquée comme ignorée");
    } catch (error) {
      setAction(previous);
      toast.error(error instanceof Error ? error.message : "Erreur");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Back button skeleton */}
        <Skeleton className="h-9 w-36" />

        {/* Card skeleton */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-7 w-3/4" />
                <div className="flex items-center gap-2">
                  <Skeleton className="size-4" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="size-4" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Phrase source skeleton */}
            <div>
              <Skeleton className="mb-2 h-4 w-24" />
              <div className="rounded-lg border bg-muted/50 p-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="mt-2 h-4 w-2/3" />
              </div>
            </div>

            {/* Échéance skeleton */}
            <div>
              <Skeleton className="mb-2 h-4 w-16" />
              <Skeleton className="h-10 w-48 rounded-lg" />
            </div>

            {/* Métadonnées skeleton */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-32" />
              </div>
              <div className="space-y-1">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-5 w-32" />
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex gap-2">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 flex-1" />
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (!action) {
    return null;
  }

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

  // L'`emailFrom` peut etre `Nom <email>` — on extrait l'adresse pour
  // l'affichage compact, comme le fait `action-card.tsx`. Evite l'enroulement
  // sur 2-3 lignes en mobile et garde une info utile (le domaine).
  const displaySender = (() => {
    const match = action.emailFrom.match(/<([^>]+)>/);
    return (match ? match[1] : action.emailFrom).trim();
  })();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <BackButton label="Retour aux actions" fallbackUrl="/actions" />
      </div>

      {/* Main Card */}
      <Card
        className={cn(
          isOverdue && "border-red-300 bg-red-50/50",
          isUrgent && !isOverdue && "border-orange-300 bg-orange-50/50"
        )}
      >
        <CardHeader className="space-y-3">
          {/* Ligne badges — leur propre rangee (calque sur action-card) :
              les libelles custom longs cessent ainsi d'ecraser le titre */}
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className={cn(typeDisplay.badgeClasses, "max-w-full break-words text-xs")}>
              {typeDisplay.label}
            </Badge>
            <Badge variant="secondary" className={cn(statusInfo.color, "text-xs")}>
              {statusInfo.label}
            </Badge>
          </div>

          {/* Titre — responsive */}
          <CardTitle className="break-words text-xl leading-snug sm:text-2xl">
            {decodeHtmlEntities(action.title)}
          </CardTitle>

          {/* Metadonnees — flex-wrap sans bullet ; le retour a la ligne
              naturel evite le `•` orphelin de la version precedente */}
          <CardDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
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
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
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
                <Calendar className="size-4" />
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
        </CardContent>

        <CardFooter className="flex flex-col gap-2 sm:flex-row">
          {action.status === "TODO" ? (
            <>
              <Button
                onClick={handleMarkDone}
                disabled={actionLoading}
                className="h-11 w-full sm:h-10 sm:flex-1"
              >
                <Check className="mr-2 size-4" />
                Marquer comme fait
              </Button>
              <Button
                onClick={handleMarkIgnored}
                disabled={actionLoading}
                variant="outline"
                className="h-11 w-full sm:h-10 sm:flex-1"
              >
                <X className="mr-2 size-4" />
                Ignorer
              </Button>
            </>
          ) : (
            <div className="w-full text-center text-sm text-muted-foreground">
              Cette action est {action.status === "DONE" ? "terminée" : "ignorée"}
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
