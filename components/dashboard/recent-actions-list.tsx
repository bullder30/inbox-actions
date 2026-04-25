"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ActionCard } from "@/components/actions/action-card";
import type { ActionWithUser } from "@/lib/api/actions";

interface RecentActionsListProps {
  actions: ActionWithUser[];
}

export function RecentActionsList({ actions }: RecentActionsListProps) {
  // État local pour permettre l'optimistic removal avec exit animation,
  // tout en restant aligné avec les props après router.refresh().
  const [items, setItems] = useState(actions);

  useEffect(() => {
    setItems(actions);
  }, [actions]);

  function handleRemove(id: string) {
    setItems((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <AnimatePresence mode="popLayout" initial={false}>
        {items.map((action) => (
          <motion.div
            key={action.id}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: 60, transition: { duration: 0.18, ease: "easeIn" } }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            whileHover={{ scale: 1.003, transition: { duration: 0.15 } }}
          >
            <ActionCard
              action={action}
              onUpdate={(newStatus) => {
                // Retirer la card visuellement quand l'action change de statut.
                // router.refresh() (déclenché par ActionCard) va re-fetcher les
                // recent actions côté serveur et resync via useEffect ci-dessus.
                if (newStatus === "DONE" || newStatus === "IGNORED" || newStatus === "SCHEDULED") {
                  handleRemove(action.id);
                }
              }}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
