"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow, format } from "date-fns";
import { fr } from "date-fns/locale";
import { ActionWithUser, ActionWithUserPrisma } from "@/lib/api/actions";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Check,
  X,
  Calendar,
  Mail,
  ExternalLink,
  Clock,
  MailOpen,
  Inbox,
  MoreHorizontal,
  UserX,
  Globe,
  CalendarClock,
} from "lucide-react";
import { cn, decodeHtmlEntities } from "@/lib/utils";
import { toast } from "sonner";
import { markActionAsDone, markActionAsIgnored } from "@/lib/api/actions";

interface ActionCardProps {
  // Accepte les deux types: API (imapUID string) et Prisma (imapUID BigInt)
  action: ActionWithUser | ActionWithUserPrisma;
  onUpdate?: (newStatus?: "DONE" | "IGNORED" | "SCHEDULED" | "TODO") => void;
  variant?: "default" | "compact";
}

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

export function ActionCard({ action, onUpdate, variant = "default" }: ActionCardProps) {
  const [loading, setLoading] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [exclusionOpen, setExclusionOpen] = useState(false);
  const exclusionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  function handleExclusionOpenChange(open: boolean) {
    if (open) {
      setExclusionOpen(true);
      exclusionTimerRef.current = setTimeout(() => setExclusionOpen(false), 3000);
    } else {
      if (exclusionTimerRef.current) {
        clearTimeout(exclusionTimerRef.current);
        exclusionTimerRef.current = null;
      }
      setExclusionOpen(false);
    }
  }

  const typeInfo = actionTypeLabels[action.type];
  const statusInfo = actionStatusLabels[action.status];

  // Urgence et retard — actifs pour TODO et SCHEDULED
  const isActionable = action.status === "TODO";

  const isOverdue =
    action.dueDate &&
    new Date(action.dueDate) < new Date() &&
    isActionable;

  const isUrgent =
    action.dueDate &&
    !isOverdue &&
    new Date(action.dueDate) < new Date(Date.now() + 24 * 60 * 60 * 1000) &&
    isActionable;

  // Planifiée manuellement et pas encore urgente — panel neutre bleu
  const isScheduledNeutral = action.isScheduled && !isUrgent && !isOverdue && isActionable;

  async function handleMarkDone() {
    try {
      setLoading(true);
      await markActionAsDone(action.id);
      toast.success("Action marquée comme terminée");
      if (onUpdate) onUpdate("DONE");
      else router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkIgnored() {
    try {
      setLoading(true);
      await markActionAsIgnored(action.id);
      toast.success("Action marquée comme ignorée");
      if (onUpdate) onUpdate("IGNORED");
      else router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  async function handleSchedule(date: Date | undefined) {
    if (!date) return;
    try {
      setLoading(true);
      // Si aujourd'hui → fin de journée pour éviter l'affichage immédiat en "dépassée"
      const scheduled = new Date(date);
      const isToday = scheduled.toDateString() === new Date().toDateString();
      if (isToday) scheduled.setHours(23, 59, 59, 999);

      const res = await fetch(`/api/actions/${action.id}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dueDate: scheduled.toISOString() }),
      });
      if (!res.ok) throw new Error();
      toast.success(
        isToday
          ? "Échéance définie pour aujourd'hui"
          : `Action planifiée pour le ${format(date, "d MMMM", { locale: fr })}`
      );
      setScheduleOpen(false);
      if (onUpdate) onUpdate(isToday ? "TODO" : "SCHEDULED");
      else router.refresh();
    } catch {
      toast.error("Erreur lors de la planification");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddExclusion(type: "SENDER" | "DOMAIN") {
    const from = action.emailFrom;
    const match = from.match(/<([^>]+)>/);
    const email = (match ? match[1] : from).trim().toLowerCase();

    let value: string;
    let label: string;

    if (type === "SENDER") {
      value = email;
      label = email;
    } else {
      const atIndex = email.indexOf("@");
      if (atIndex === -1) {
        toast.error("Impossible d'extraire le domaine");
        return;
      }
      value = email.slice(atIndex + 1);
      label = `@${value}`;
    }

    // Fermer le dropdown et annuler le timer avant l'appel API
    if (exclusionTimerRef.current) {
      clearTimeout(exclusionTimerRef.current);
      exclusionTimerRef.current = null;
    }
    setExclusionOpen(false);

    try {
      const res = await fetch("/api/exclusions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, value, label }),
      });

      if (res.status === 409) {
        toast.info("Cette exclusion existe déjà");
        return;
      }
      if (!res.ok) throw new Error();

      const data = await res.json();
      const deleted = data.deletedActions ?? 0;
      toast.success(
        deleted > 0
          ? `Exclusion ajoutée : ${label} (${deleted} action${deleted > 1 ? "s" : ""} supprimée${deleted > 1 ? "s" : ""})`
          : `Exclusion ajoutée : ${label}`
      );
      if (onUpdate) onUpdate();
      else router.refresh();
    } catch {
      toast.error("Erreur lors de l'ajout de l'exclusion");
    }
  }

  // ── Bouton Planifier (réutilisé dans les deux variants) ──────────────────
  const scheduleButton = isActionable ? (
    <Popover open={scheduleOpen} onOpenChange={setScheduleOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={loading}
          className="w-full sm:w-auto"
        >
          <CalendarClock className="mr-2 size-4" />
          {action.dueDate ? "Replanifier" : "Planifier"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <CalendarComponent
          mode="single"
          selected={action.dueDate ? new Date(action.dueDate) : undefined}
          onSelect={handleSchedule}
          disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
          locale={fr}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  ) : null;

  // ── Variant compact ──────────────────────────────────────────────────────
  if (variant === "compact") {
    return (
      <Card className={cn(
        "overflow-hidden transition-all hover:shadow-md",
        isOverdue && "border-red-300 bg-red-50/50",
        isUrgent && "border-orange-300 bg-orange-50/50",
        isScheduledNeutral && "border-blue-200 bg-blue-50/30"
      )}>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0 flex-1 space-y-1">
              <CardTitle className="break-words text-sm sm:text-base">{decodeHtmlEntities(action.title)}</CardTitle>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Mail className="size-3 shrink-0" />
                  <span className="break-all">
                    {(() => {
                      const am = action.emailFrom.match(/<([^>]+)>/);
                      return (am ? am[1] : action.emailFrom).trim();
                    })()}
                  </span>
                </span>
                {action.mailboxLabel && (
                  <span className="flex items-center gap-1">
                    <Inbox className="size-3 shrink-0" />
                    <span>{action.mailboxLabel}</span>
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={cn(typeInfo.color, "text-xs")}>
                {typeInfo.label}
              </Badge>
              <Badge variant="secondary" className={cn(statusInfo.color, "text-xs")}>
                {statusInfo.label}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardFooter className="pt-0">
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            {action.dueDate && isActionable && (
              <div className={cn(
                "flex items-center gap-1 text-xs",
                isOverdue
                  ? "font-medium text-red-700"
                  : isUrgent
                  ? "font-medium text-orange-700"
                  : "text-blue-700"
              )}>
                <Calendar className="size-3 shrink-0" />
                <span>
                  {isOverdue ? "⚠️ En retard" : isUrgent ? "⏰ Urgent" : "📅 Planifiée"}{" "}
                  {formatDistanceToNow(new Date(action.dueDate), { locale: fr, addSuffix: true })}
                </span>
              </div>
            )}
            <div className="flex gap-2 sm:ml-auto">
              <Link href={`/actions/${action.id}`} className="w-full sm:w-auto">
                <Button variant="ghost" size="sm" className="w-full sm:w-auto">
                  <ExternalLink className="mr-2 size-4 sm:mr-0" />
                  <span className="sm:hidden">Voir</span>
                </Button>
              </Link>
            </div>
          </div>
        </CardFooter>
      </Card>
    );
  }

  // ── Variant default ──────────────────────────────────────────────────────
  const displaySender = (() => {
    const angleMatch = action.emailFrom.match(/<([^>]+)>/);
    return (angleMatch ? angleMatch[1] : action.emailFrom).trim();
  })();

  return (
    <Card className={cn(
      "overflow-hidden transition-all hover:shadow-lg",
      isOverdue && "border-red-300 bg-red-50/50",
      isUrgent && "border-orange-300 bg-orange-50/50",
      isScheduledNeutral && "border-blue-200 bg-blue-50/30"
    )}>
      <CardHeader className="space-y-2 pb-3">
        {/* Ligne 1 : badges + menu */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className={cn(typeInfo.color, "text-xs")}>
              {typeInfo.label}
            </Badge>
            <Badge variant="secondary" className={cn(statusInfo.color, "text-xs")}>
              {statusInfo.label}
            </Badge>
          </div>
          {isActionable && (
            <DropdownMenu open={exclusionOpen} onOpenChange={handleExclusionOpenChange} modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="size-7 shrink-0 p-0">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleAddExclusion("SENDER")}>
                  <UserX className="mr-2 size-4" />
                  Exclure cet expéditeur
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAddExclusion("DOMAIN")}>
                  <Globe className="mr-2 size-4" />
                  Exclure ce domaine
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Titre */}
        <CardTitle className="break-words text-base leading-snug sm:text-lg">
          {decodeHtmlEntities(action.title)}
        </CardTitle>

        {/* Métadonnées */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Mail className="size-3 shrink-0" />
            <span className="break-all">{displaySender}</span>
          </span>
          <span className="flex items-center gap-1">
            <Clock className="size-3 shrink-0" />
            <span>Reçu {formatDistanceToNow(new Date(action.emailReceivedAt), { locale: fr, addSuffix: true })}</span>
          </span>
          {action.mailboxLabel && (
            <span className="flex items-center gap-1">
              <Inbox className="size-3 shrink-0" />
              <span>{action.mailboxLabel}</span>
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        {/* Panel date */}
        {action.dueDate && isActionable && (
          <div className={cn(
            "flex items-center gap-2 rounded-lg border p-3",
            isOverdue
              ? "border-red-300 bg-red-50 text-red-800"
              : isUrgent
              ? "border-orange-300 bg-orange-50 text-orange-800"
              : "border-blue-200 bg-blue-50 text-blue-800"
          )}>
            <Calendar className="size-4 shrink-0" />
            <span className="text-sm font-medium">
              {isOverdue ? "⚠️ En retard" : isUrgent ? "⏰ Urgent" : "📅 Planifiée pour le"}{" "}
              {new Date(action.dueDate).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
          </div>
        )}

        {/* Phrase source */}
        <blockquote className="overflow-hidden rounded-lg border-l-4 bg-muted/50 p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 flex-1 break-words text-sm italic">
              &ldquo;{decodeHtmlEntities(action.sourceSentence)}&rdquo;
            </p>
            {action.emailWebUrl && (
              <a
                href={action.emailWebUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                <Button variant="ghost" size="sm" className="size-7 shrink-0 p-0">
                  <MailOpen className="size-3.5" />
                </Button>
              </a>
            )}
          </div>
        </blockquote>
      </CardContent>

      <CardFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        {isActionable ? (
          <>
            <Button
              onClick={handleMarkDone}
              disabled={loading}
              variant="default"
              size="sm"
              className="w-full sm:w-auto"
            >
              <Check className="mr-2 size-4" />
              Fait
            </Button>
            {scheduleButton}
            <Button
              onClick={handleMarkIgnored}
              disabled={loading}
              variant="ghost"
              size="sm"
              className="w-full sm:w-auto"
            >
              <X className="mr-2 size-4" />
              Ignorer
            </Button>
          </>
        ) : (
          <Link href={`/actions/${action.id}`} className="w-full">
            <Button variant="outline" className="w-full">
              <ExternalLink className="mr-2 size-4" />
              Voir les détails
            </Button>
          </Link>
        )}
      </CardFooter>
    </Card>
  );
}
