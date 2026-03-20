"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ActionCard } from "@/components/actions/action-card";
import { ActionCardSkeletonList } from "@/components/actions/action-card-skeleton";
import { ActionWithUser } from "@/lib/api/actions";
import { EmptyState } from "@/components/actions/empty-state";
import { getActions } from "@/lib/api/actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type StatusFilter = "TODO" | "SCHEDULED" | "DONE" | "IGNORED";

const PAGE_SIZE = 20;

const filterConfig: {
  status: StatusFilter;
  label: string;
  inactive: string;
  active: string;
  badgeInactive?: string; // classe Tailwind bg- pour le badge quand inactif
}[] = [
  {
    status: "TODO",
    label: "Aujourd'hui",
    inactive: "bg-slate-100 text-slate-700 hover:bg-slate-200",
    active: "bg-slate-700 text-white",
    badgeInactive: "bg-slate-600",
  },
  {
    status: "SCHEDULED",
    label: "À venir",
    inactive: "bg-blue-100 text-blue-700 hover:bg-blue-200",
    active: "bg-blue-600 text-white",
    badgeInactive: "bg-blue-600",
  },
  {
    status: "DONE",
    label: "Terminées",
    inactive: "bg-green-100 text-green-700 hover:bg-green-200",
    active: "bg-green-600 text-white",
  },
  {
    status: "IGNORED",
    label: "Ignorées",
    inactive: "bg-gray-100 text-gray-600 hover:bg-gray-200",
    active: "bg-gray-500 text-white",
  },
];

const filterTitles: Record<StatusFilter, string> = {
  TODO: "Actions du jour",
  SCHEDULED: "Actions à venir",
  DONE: "Actions terminées",
  IGNORED: "Actions ignorées",
};

export default function ActionsPage() {
  const [actions, setActions] = useState<ActionWithUser[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [emailsAnalyzed, setEmailsAnalyzed] = useState(0);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("TODO");
  const [todayCount, setTodayCount] = useState(0);
  const [scheduledCount, setScheduledCount] = useState(0);
  const [doneCount, setDoneCount] = useState(0);
  const [ignoredCount, setIgnoredCount] = useState(0);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingMoreRef = useRef(false);

  // Charger les actions pour le filtre courant
  async function loadActions(filter: StatusFilter, currentOffset: number, append = false) {
    try {
      const data = await getActions({ status: filter, limit: PAGE_SIZE, offset: currentOffset });
      if (append) {
        setActions((prev) => [...prev, ...data.actions]);
      } else {
        setActions(data.actions);
      }
      setHasMore(data.hasMore);
      setOffset(currentOffset + PAGE_SIZE);
      if (filter === "TODO") setTodayCount(data.total);
      if (filter === "SCHEDULED") setScheduledCount(data.total);
      if (filter === "DONE") setDoneCount(data.total);
      if (filter === "IGNORED") setIgnoredCount(data.total);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur de chargement");
    }
  }

  // Chargement initial
  useEffect(() => {
    async function init() {
      try {
        const [data, statsRes, scheduledRes, doneRes, ignoredRes] = await Promise.all([
          getActions({ status: "TODO", limit: PAGE_SIZE, offset: 0 }),
          fetch("/api/email/stats"),
          getActions({ status: "SCHEDULED", limit: 1, offset: 0 }),
          getActions({ status: "DONE", limit: 1, offset: 0 }),
          getActions({ status: "IGNORED", limit: 1, offset: 0 }),
        ]);
        setActions(data.actions);
        setHasMore(data.hasMore);
        setOffset(PAGE_SIZE);
        setTodayCount(data.total);
        setScheduledCount(scheduledRes.total);
        setDoneCount(doneRes.total);
        setIgnoredCount(ignoredRes.total);
        if (statsRes.ok) {
          const stats = await statsRes.json();
          setEmailsAnalyzed(stats.analyzedCount || 0);
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Erreur de chargement");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // Charger la page suivante
  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      await loadActions(statusFilter, offset, true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur de chargement");
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [hasMore, offset, statusFilter]);

  // Observer la sentinelle
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  // Changer de filtre
  async function switchFilter(filter: StatusFilter) {
    if (filter === statusFilter) return;
    setStatusFilter(filter);
    setLoading(true);
    setOffset(0);
    setActions([]);
    try {
      await loadActions(filter, 0, false);
    } finally {
      setLoading(false);
    }
  }

  type MutationStatus = "DONE" | "IGNORED" | "SCHEDULED" | "TODO";

  // Incrémenter le counter du filtre de destination après une mutation
  function incrementCount(newStatus?: MutationStatus) {
    if (newStatus === "DONE") setDoneCount((prev) => prev + 1);
    if (newStatus === "IGNORED") setIgnoredCount((prev) => prev + 1);
    if (newStatus === "SCHEDULED") {
      getActions({ status: "SCHEDULED", limit: 1, offset: 0 })
        .then((res) => setScheduledCount(res.total))
        .catch(() => {});
    }
  }

  // Suppression optimiste après mutation (DONE ou IGNORED depuis un onglet quelconque)
  function handleRemove(id: string, newStatus?: MutationStatus) {
    setActions((prev) => prev.filter((a) => a.id !== id));
    if (statusFilter === "TODO") setTodayCount((prev) => Math.max(0, prev - 1));
    if (statusFilter === "SCHEDULED") setScheduledCount((prev) => Math.max(0, prev - 1));
    incrementCount(newStatus);
  }

  // Après une planification depuis TODO : retirer la card + MAJ badges
  function handleUpdate(id: string, newStatus?: MutationStatus) {
    setActions((prev) => prev.filter((a) => a.id !== id));
    if (statusFilter === "TODO") setTodayCount((prev) => Math.max(0, prev - 1));
    incrementCount(newStatus);
  }

  // Recharger la liste courante (ex: planification → aujourd'hui, la card reste en TODO)
  function handleReloadCurrent() {
    setLoading(true);
    setOffset(0);
    setActions([]);
    loadActions(statusFilter, 0, false).finally(() => setLoading(false));
  }

  // Après une replanification depuis SCHEDULED, recharger la liste (la date a changé)
  function handleReschedule() {
    loadActions("SCHEDULED", 0, false).catch(() => {});
  }

  return (
    <>
      {/* Header + filtres */}
      <div className="space-y-4">
        <h1 className="font-heading text-2xl font-semibold">{filterTitles[statusFilter]}</h1>

        {/* Boutons filtre */}
        <div className="grid grid-cols-4 gap-1.5 sm:flex sm:flex-wrap sm:gap-2">
          {filterConfig.map(({ status, label, inactive, active, badgeInactive }) => {
            const isActive = statusFilter === status;
            const countMap: Record<string, number> = { TODO: todayCount, SCHEDULED: scheduledCount, DONE: doneCount, IGNORED: ignoredCount };
            const count = countMap[status] ?? 0;
            const isEmpty = status !== "TODO" && !isActive && count === 0;
            return (
              <button
                key={status}
                onClick={() => !isEmpty && switchFilter(status)}
                disabled={isEmpty}
                className={cn(
                  "relative inline-flex items-center justify-center rounded-full px-2 py-1.5 text-xs font-medium transition-colors sm:px-4 sm:text-sm",
                  isActive ? active : inactive,
                  isEmpty && "cursor-not-allowed opacity-40"
                )}
              >
                {label}
                {badgeInactive && count > 0 && (
                  <span
                    className={cn(
                      "ml-1.5 inline-flex size-5 items-center justify-center rounded-full text-[10px] font-bold tabular-nums leading-none text-white",
                      isActive ? "bg-white/25" : badgeInactive
                    )}
                  >
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Liste */}
      {loading ? (
        <ActionCardSkeletonList
          count={1}
          variant={statusFilter === "DONE" || statusFilter === "IGNORED" ? "done-ignored" : "default"}
        />
      ) : actions.length === 0 ? (
        <EmptyState emailsAnalyzed={emailsAnalyzed} filter={statusFilter} />
      ) : (
        <div className="space-y-4">
          {actions.map((action) => (
            <ActionCard
              key={action.id}
              action={action}
              onUpdate={
                statusFilter === "SCHEDULED"
                  ? (newStatus) =>
                      newStatus === "SCHEDULED"
                        ? handleReschedule()
                        : newStatus === "TODO"
                        ? handleRemove(action.id, undefined) // retour en TODO → retirer de SCHEDULED
                        : handleRemove(action.id, newStatus)
                  : (newStatus) =>
                      newStatus === "TODO"
                        ? handleReloadCurrent() // planifié aujourd'hui → reste en TODO, rafraîchir
                        : handleUpdate(action.id, newStatus)
              }
            />
          ))}
          <div ref={sentinelRef} className="h-1" />
          {loadingMore && <ActionCardSkeletonList count={1} />}
        </div>
      )}
    </>
  );
}
