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
  Loader2,
  MailOpen,
} from "lucide-react";
import { BackButton } from "@/components/shared/back-button";
import { cn, decodeHtmlEntities } from "@/lib/utils";
import { toast } from "sonner";

const actionTypeLabels = {
  SEND: { label: "Envoyer", color: "bg-blue-100 text-blue-800 border-blue-200" },
  CALL: { label: "Appeler", color: "bg-green-100 text-green-800 border-green-200" },
  FOLLOW_UP: { label: "Relancer", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  PAY: { label: "Payer", color: "bg-purple-100 text-purple-800 border-purple-200" },
  VALIDATE: { label: "Valider", color: "bg-orange-100 text-orange-800 border-orange-200" },
};

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
    try {
      setActionLoading(true);
      await markActionAsDone(action.id);
      toast.success("Action marquée comme terminée");
      loadAction();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleMarkIgnored() {
    if (!action) return;
    try {
      setActionLoading(true);
      await markActionAsIgnored(action.id);
      toast.success("Action marquée comme ignorée");
      loadAction();
    } catch (error) {
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

  const typeInfo = actionTypeLabels[action.type];
  const statusInfo = actionStatusLabels[action.status];

  const isUrgent =
    action.dueDate &&
    new Date(action.dueDate) < new Date(Date.now() + 24 * 60 * 60 * 1000) &&
    action.status === "TODO";

  const isOverdue =
    action.dueDate &&
    new Date(action.dueDate) < new Date() &&
    action.status === "TODO";

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
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-1">
              <CardTitle className="text-2xl">{decodeHtmlEntities(action.title)}</CardTitle>
              <CardDescription className="flex flex-wrap items-center gap-2 text-base">
                <Mail className="size-4" />
                <span>{action.emailFrom}</span>
                <span>•</span>
                <Clock className="size-4" />
                <span>
                  Reçu{" "}
                  {formatDistanceToNow(new Date(action.emailReceivedAt), {
                    locale: fr,
                    addSuffix: true,
                  })}
                </span>
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={typeInfo.color}>
                {typeInfo.label}
              </Badge>
              <Badge variant="secondary" className={statusInfo.color}>
                {statusInfo.label}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Phrase source */}
          <div>
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">
              Phrase source
            </h3>
            <div className="rounded-lg border bg-muted/50 p-4">
              <div className="flex items-start justify-between gap-4">
                <p className="flex-1 text-sm italic">&ldquo;{decodeHtmlEntities(action.sourceSentence)}&rdquo;</p>
                {action.gmailMessageId && (
                  <a
                    href={`https://mail.google.com/mail/u/0/#inbox/${action.gmailMessageId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="ghost" size="sm" className="gap-2">
                      <MailOpen className="size-4" />
                      Voir email
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

        <CardFooter className="flex gap-2">
          {action.status === "TODO" ? (
            <>
              <Button
                onClick={handleMarkDone}
                disabled={actionLoading}
                className="flex-1"
              >
                <Check className="mr-2 size-4" />
                Marquer comme fait
              </Button>
              <Button
                onClick={handleMarkIgnored}
                disabled={actionLoading}
                variant="outline"
                className="flex-1"
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
