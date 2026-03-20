
-- 1. Ajouter le flag de planification
ALTER TABLE actions ADD COLUMN IF NOT EXISTS "isScheduled" BOOLEAN NOT NULL DEFAULT false;

-- 2. Index composite pour les filtres "Aujourd'hui" / "À venir"
CREATE INDEX IF NOT EXISTS "actions_userId_status_isScheduled_dueDate_idx"
  ON actions ("userId", status, "isScheduled", "dueDate");
