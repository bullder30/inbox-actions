"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ActionCard } from "@/components/actions/action-card";
import { ActionCardSkeletonList } from "@/components/actions/action-card-skeleton";
import { ActionWithUser } from "@/lib/api/actions";
import { EmptyState } from "@/components/actions/empty-state";
import { getActions } from "@/lib/api/actions";
import { toast } from "sonner";

const PAGE_SIZE = 20;

export default function ActionsPage() {
  const [actions, setActions] = useState<ActionWithUser[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [emailsAnalyzed, setEmailsAnalyzed] = useState(0);
  const sentinelRef = useRef<HTMLDivElement>(null);
  // Ref pour éviter les double-appels si l'observer fire avant le re-render
  const loadingMoreRef = useRef(false);

  // Chargement initial
  useEffect(() => {
    async function init() {
      try {
        const [data, statsRes] = await Promise.all([
          getActions({ status: "TODO", limit: PAGE_SIZE, offset: 0 }),
          fetch("/api/email/stats"),
        ]);
        setActions(data.actions);
        setHasMore(data.hasMore);
        setOffset(PAGE_SIZE);
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
      const data = await getActions({ status: "TODO", limit: PAGE_SIZE, offset });
      setActions((prev) => [...prev, ...data.actions]);
      setHasMore(data.hasMore);
      setOffset((prev) => prev + PAGE_SIZE);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur de chargement");
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [hasMore, offset]);

  // Observer la sentinelle pour déclencher le chargement suivant
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

  // Suppression optimiste après mutation (done / ignore)
  function handleRemove(id: string) {
    setActions((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <>
      <div>
        <h1 className="font-heading text-2xl font-semibold">Actions à faire aujourd&apos;hui</h1>
      </div>

      {loading ? (
        <ActionCardSkeletonList count={1} />
      ) : actions.length === 0 ? (
        <EmptyState emailsAnalyzed={emailsAnalyzed} />
      ) : (
        <div className="space-y-4">
          {actions.map((action) => (
            <ActionCard
              key={action.id}
              action={action}
              onUpdate={() => handleRemove(action.id)}
            />
          ))}
          {/* Sentinelle : quand elle devient visible, on charge la page suivante */}
          <div ref={sentinelRef} className="h-1" />
          {loadingMore && <ActionCardSkeletonList count={1} />}
        </div>
      )}
    </>
  );
}
