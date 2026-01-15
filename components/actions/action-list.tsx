"use client";

import { ActionWithUser } from "@/lib/api/actions";
import { ActionCard } from "./action-card";

interface ActionListProps {
  actions: ActionWithUser[];
  onUpdate?: () => void;
  variant?: "default" | "compact";
}

export function ActionList({
  actions,
  onUpdate,
  variant = "default",
}: ActionListProps) {
  return (
    <div className="space-y-4">
      {actions.map((action) => (
        <ActionCard
          key={action.id}
          action={action}
          onUpdate={onUpdate}
          variant={variant}
        />
      ))}
    </div>
  );
}
