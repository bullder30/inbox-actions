"use client";

import { useEffect, useState } from "react";

import { ActionCardSkeletonList } from "@/components/actions/action-card-skeleton";
import { ActionList } from "@/components/actions/action-list";
import { ActionWithUser } from "@/lib/api/actions";
import { EmptyState } from "@/components/actions/empty-state";
import { getActions } from "@/lib/api/actions";
import { toast } from "sonner";

export default function ActionsPage() {
  const [actions, setActions] = useState<ActionWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [emailsAnalyzed, setEmailsAnalyzed] = useState(0);

  async function loadActions() {
    try {
      setLoading(true);
      // Charger uniquement les actions TODO
      const data = await getActions({ status: "TODO" });
      setActions(data.actions);

      // Récupérer le nombre d'emails analysés
      const statsResponse = await fetch("/api/gmail/stats");
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setEmailsAnalyzed(statsData.analyzedCount || 0);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erreur de chargement"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadActions();
  }, []);

  function handleUpdate() {
    loadActions();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Actions à faire aujourd&apos;hui</h1>
      </div>

      {loading ? (
        <ActionCardSkeletonList count={3} />
      ) : actions.length === 0 ? (
        <EmptyState emailsAnalyzed={emailsAnalyzed} />
      ) : (
        <ActionList actions={actions} onUpdate={handleUpdate} />
      )}
    </div>
  );
}

