"use client";

import { motion } from "motion/react";
import { Calendar, Check, Clock, Mail, MailOpen, Phone, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Mockup statique du dashboard pour le hero de la landing.
 * Pas de dépendance aux types de prod — visuel pur.
 */
export function DashboardMockup() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, rotate: -1 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ duration: 0.7, ease: "easeOut", delay: 0.15 }}
      className="relative w-full"
    >
      {/* Lueur derrière le mockup */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 rounded-3xl bg-gradient-to-br from-indigo-500/20 via-purple-500/10 to-transparent blur-2xl"
      />

      <div className="relative rounded-2xl border bg-card/95 p-3 shadow-2xl backdrop-blur sm:p-5">
        {/* Header mockup */}
        <div className="mb-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold tracking-tight sm:text-base">Actions du jour</h3>
            <span className="rounded-full bg-slate-700 px-2 py-0.5 text-[10px] font-bold text-white">3</span>
          </div>
          {/* Pills filtre */}
          <div className="flex gap-1.5">
            <FilterPill active>Aujourd&apos;hui · 3</FilterPill>
            <FilterPill>À venir · 2</FilterPill>
            <FilterPill>Terminées</FilterPill>
          </div>
        </div>

        {/* Cards */}
        <div className="space-y-2.5">
          <MockCard
            type="SEND"
            urgency="urgent"
            title="Envoyer le rapport financier de Q4"
            sender="client@acme.com"
            phrase="peux-tu m'envoyer le rapport financier de Q4"
            urgencyLabel="Urgent · vendredi"
            delay={0.4}
          />
          <MockCard
            type="CALL"
            title="Rappeler pour finaliser le contrat"
            sender="partenaire@studio.fr"
            phrase="merci de me rappeler demain matin"
            urgencyLabel="Demain matin"
            delay={0.55}
          />
          <MockCard
            type="DONE"
            title="Valider la maquette homepage"
            sender="design@studio.fr"
            delay={0.7}
          />
        </div>
      </div>
    </motion.div>
  );
}

function FilterPill({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-medium sm:text-[11px]",
        active
          ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900"
          : "bg-muted text-muted-foreground"
      )}
    >
      {children}
    </span>
  );
}

const typeConfig = {
  SEND: {
    label: "Envoyer",
    badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    icon: Mail,
  },
  CALL: {
    label: "Appeler",
    badge: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    icon: Phone,
  },
  DONE: {
    label: "Terminé",
    badge: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
    icon: Check,
  },
} as const;

interface MockCardProps {
  type: keyof typeof typeConfig;
  urgency?: "urgent" | "overdue";
  title: string;
  sender: string;
  phrase?: string;
  urgencyLabel?: string;
  delay: number;
}

function MockCard({ type, urgency, title, sender, phrase, urgencyLabel, delay }: MockCardProps) {
  const cfg = typeConfig[type];
  const Icon = cfg.icon;
  const isDone = type === "DONE";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
      className={cn(
        "rounded-lg border p-3 sm:p-3.5",
        urgency === "urgent" && "border-orange-300 bg-orange-50/50 dark:border-orange-800/60 dark:bg-orange-950/30",
        urgency === "overdue" && "border-red-300 bg-red-50/50 dark:border-red-800/60 dark:bg-red-950/30",
        !urgency && !isDone && "bg-card",
        isDone && "bg-card opacity-60"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className={cn("inline-flex items-center gap-1 rounded-md border-transparent px-1.5 py-0.5 text-[10px] font-medium sm:text-xs", cfg.badge)}>
            <Icon className="size-3" strokeWidth={2.2} />
            {cfg.label}
          </span>
          {isDone && (
            <span className="inline-flex items-center gap-1 rounded-md bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300 sm:text-xs">
              <Check className="size-3" strokeWidth={2.5} />
              Fait
            </span>
          )}
        </div>
        <button
          type="button"
          tabIndex={-1}
          className="pointer-events-none rounded p-0.5 text-muted-foreground/50"
          aria-hidden
        >
          <MailOpen className="size-3.5" />
        </button>
      </div>

      <p className={cn("mt-1.5 text-[13px] font-bold leading-snug tracking-tight sm:text-sm", isDone && "line-through")}>
        {title}
      </p>

      <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground sm:text-[11px]">
        <Mail className="size-3 shrink-0" />
        <span className="truncate">{sender}</span>
      </p>

      {phrase && (
        <blockquote className="mt-2 rounded border-l-2 border-muted-foreground/30 bg-muted/40 px-2 py-1 text-[11px] italic leading-snug text-muted-foreground sm:text-xs">
          &ldquo;{phrase}&rdquo;
        </blockquote>
      )}

      {urgencyLabel && !isDone && (
        <div
          className={cn(
            "mt-2 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium sm:text-[11px]",
            urgency === "urgent" && "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
            !urgency && "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
          )}
        >
          {urgency === "urgent" ? <Clock className="size-3" /> : <Calendar className="size-3" />}
          {urgencyLabel}
        </div>
      )}

      {!isDone && (
        <div className="mt-2.5 flex justify-end gap-1.5">
          <span className="inline-flex h-6 items-center gap-1 rounded-md bg-slate-900 px-2 text-[10px] font-medium text-white dark:bg-slate-200 dark:text-slate-900 sm:text-[11px]">
            <Check className="size-3" /> Fait
          </span>
          <span className="inline-flex h-6 items-center gap-1 rounded-md border px-2 text-[10px] font-medium text-muted-foreground sm:text-[11px]">
            <X className="size-3" /> Ignorer
          </span>
        </div>
      )}
    </motion.div>
  );
}
