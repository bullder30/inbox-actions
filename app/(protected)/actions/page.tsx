"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { mutate as globalMutate } from "swr";
import useSWRInfinite from "swr/infinite";

import { ActionCard } from "@/components/actions/action-card";
import { ActionCardSkeletonList } from "@/components/actions/action-card-skeleton";
import { GetActionsResponse } from "@/lib/api/actions";
import { EmptyState } from "@/components/actions/empty-state";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type StatusFilter = "TODO" | "SCHEDULED" | "DONE" | "IGNORED";

const PAGE_SIZE = 20;

const filterConfig: {
  status: StatusFilter;
  label: string;
  labelShort: string;
  inactive: string;
  active: string;
  badgeInactive?: string;
}[] = [
  {
    status: "TODO",
    label: "Aujourd'hui",
    labelShort: "Auj.",
    inactive: "bg-slate-100 text-slate-700 hover:bg-slate-200",
    active: "bg-slate-700 text-white",
    badgeInactive: "bg-slate-600",
  },
  {
    status: "SCHEDULED",
    label: "À venir",
    labelShort: "À venir",
    inactive: "bg-blue-100 text-blue-700 hover:bg-blue-200",
    active: "bg-blue-600 text-white",
    badgeInactive: "bg-blue-600",
  },
  {
    status: "DONE",
    label: "Terminées",
    labelShort: "Terminées",
    inactive: "bg-green-100 text-green-700 hover:bg-green-200",
    active: "bg-green-600 text-white",
  },
  {
    status: "IGNORED",
    label: "Ignorées",
    labelShort: "Ignorées",
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

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Erreur de chargement");
  }
  return res.json();
};

export default function ActionsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("TODO");
  const sentinelRef = useRef<HTMLDivElement>(null);

  // ── Compteurs badges (4 requêtes légères, limit=1 → juste le total) ────
  const { data: todoCountData, mutate: mutateTodoCount } =
    useSWR<GetActionsResponse>(`/api/actions?status=TODO&limit=1&offset=0`, fetcher);
  const { data: scheduledCountData, mutate: mutateScheduledCount } =
    useSWR<GetActionsResponse>(`/api/actions?status=SCHEDULED&limit=1&offset=0`, fetcher);
  const { data: doneCountData, mutate: mutateDoneCount } =
    useSWR<GetActionsResponse>(`/api/actions?status=DONE&limit=1&offset=0`, fetcher);
  const { data: ignoredCountData, mutate: mutateIgnoredCount } =
    useSWR<GetActionsResponse>(`/api/actions?status=IGNORED&limit=1&offset=0`, fetcher);

  const todayCount = todoCountData?.total ?? 0;
  const scheduledCount = scheduledCountData?.total ?? 0;
  const doneCount = doneCountData?.total ?? 0;
  const ignoredCount = ignoredCountData?.total ?? 0;

  // ── Stats emails ────────────────────────────────────────────────────────
  const { data: emailStats } = useSWR<{ analyzedCount: number }>(
    "/api/email/stats",
    fetcher
  );
  const emailsAnalyzed = emailStats?.analyzedCount ?? 0;

  // ── Liste paginée (clé inclut le filtre → cache par filtre) ────────────
  const getKey = useCallback(
    (pageIndex: number, previousPageData: GetActionsResponse | null) => {
      if (previousPageData && !previousPageData.hasMore) return null;
      return `/api/actions?status=${statusFilter}&limit=${PAGE_SIZE}&offset=${pageIndex * PAGE_SIZE}`;
    },
    [statusFilter]
  );

  const {
    data: pages,
    size,
    setSize,
    isLoading,
    isValidating,
    mutate: mutateList,
    error: listError,
  } = useSWRInfinite<GetActionsResponse>(getKey, fetcher, {
    revalidateFirstPage: false,
    revalidateOnFocus: false,
  });

  const actions = pages?.flatMap((p) => p.actions) ?? [];
  const hasMore = pages?.[pages.length - 1]?.hasMore ?? false;
  // isLoadingMore : on a demandé une page supplémentaire mais elle n'est pas encore arrivée
  const isLoadingMore = size > 1 && typeof pages?.[size - 1] === "undefined";

  // Erreur réseau sur la liste → toast
  useEffect(() => {
    if (listError) toast.error(listError.message || "Erreur de chargement");
  }, [listError]);

  // ── Scroll infini ───────────────────────────────────────────────────────
  const loadMore = useCallback(() => {
    if (!hasMore || isValidating) return;
    setSize((s) => s + 1);
  }, [hasMore, isValidating, setSize]);

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

  // ── Changement de filtre — pas de blink : SWR sert le cache si disponible
  function switchFilter(filter: StatusFilter) {
    if (filter === statusFilter) return;
    window.scrollTo({ top: 0, behavior: "instant" });
    setStatusFilter(filter);
  }

  // ── Revalidation de tous les compteurs après mutation ───────────────────
  const revalidateAllCounts = useCallback(() => {
    mutateTodoCount();
    mutateScheduledCount();
    mutateDoneCount();
    mutateIgnoredCount();
  }, [mutateTodoCount, mutateScheduledCount, mutateDoneCount, mutateIgnoredCount]);

  type MutationStatus = "DONE" | "IGNORED" | "SCHEDULED" | "TODO";

  // Invalide le cache SWR de la vue de destination pour qu'elle soit fraîche lors du switch
  function invalidateFilterCache(status: string) {
    globalMutate(
      (key: unknown) => typeof key === "string" && key.includes(`status=${status}`),
      undefined,
      { revalidate: true }
    );
  }

  // Suppression optimiste : retire la card instantanément, revalide les compteurs
  function handleRemove(id: string, _newStatus?: MutationStatus) {
    mutateList(
      (pages) =>
        pages?.map((page) => ({
          ...page,
          actions: page.actions.filter((a) => a.id !== id),
          total: Math.max(0, page.total - 1),
        })),
      { revalidate: false }
    );
    revalidateAllCounts();
  }

  function handleUpdate(id: string, newStatus?: MutationStatus) {
    handleRemove(id, newStatus);
    // Invalider le cache de la vue destination pour éviter les données stale au switch
    if (newStatus === "DONE") invalidateFilterCache("DONE");
    else if (newStatus === "IGNORED") invalidateFilterCache("IGNORED");
    else if (newStatus === "TODO") invalidateFilterCache("TODO");
    else if (newStatus === "SCHEDULED") invalidateFilterCache("SCHEDULED");
  }

  // Recharge la liste courante (ex: planification aujourd'hui → la card reste en TODO)
  function handleReloadCurrent() {
    window.scrollTo({ top: 0, behavior: "instant" });
    mutateList();
  }

  // Après replanification depuis SCHEDULED (date changée)
  function handleReschedule() {
    mutateList();
    revalidateAllCounts();
  }

  return (
    <>
      {/* Header + filtres */}
      <div className="space-y-4">
        <h1 className="font-heading text-2xl font-semibold">{filterTitles[statusFilter]}</h1>

        {/* Boutons filtre */}
        <div className="grid grid-cols-4 gap-1 sm:flex sm:flex-wrap sm:gap-2">
          {filterConfig.map(({ status, label, labelShort, inactive, active, badgeInactive }) => {
            const isActive = statusFilter === status;
            const countMap: Record<string, number> = {
              TODO: todayCount,
              SCHEDULED: scheduledCount,
              DONE: doneCount,
              IGNORED: ignoredCount,
            };
            const count = countMap[status] ?? 0;
            const isEmpty = status !== "TODO" && !isActive && count === 0;
            return (
              <button
                key={status}
                onClick={() => !isEmpty && switchFilter(status)}
                disabled={isEmpty}
                className={cn(
                  "relative inline-flex items-center justify-center rounded-full px-1.5 py-1 text-[11px] font-medium transition-colors sm:px-4 sm:py-1.5 sm:text-sm",
                  isActive ? active : inactive,
                  isEmpty && "cursor-not-allowed opacity-40"
                )}
              >
                <span className="sm:hidden">{labelShort}</span>
                <span className="hidden sm:inline">{label}</span>
                {badgeInactive && count > 0 && (
                  <span
                    className={cn(
                      "ml-1 inline-flex size-4 items-center justify-center rounded-full text-[9px] font-bold tabular-nums leading-none text-white sm:ml-1.5 sm:size-5 sm:text-[10px]",
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
      {isLoading ? (
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
                        ? handleRemove(action.id, undefined)
                        : handleRemove(action.id, newStatus)
                  : (newStatus) =>
                      newStatus === "TODO"
                        ? handleReloadCurrent()
                        : handleUpdate(action.id, newStatus)
              }
            />
          ))}
          <div ref={sentinelRef} className="h-1" />
          {isLoadingMore && <ActionCardSkeletonList count={1} />}
        </div>
      )}
    </>
  );
}
