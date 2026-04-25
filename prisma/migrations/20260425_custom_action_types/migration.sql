-- Migration : add CustomActionType + extend ActionType enum + Action snapshot columns

-- 1. Étendre l'enum ActionType (Postgres natif, non-transactionnel — déployer avant code applicatif)
ALTER TYPE "ActionType" ADD VALUE IF NOT EXISTS 'CUSTOM';

-- 2. Créer la table custom_action_types
CREATE TABLE "custom_action_types" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "slug" TEXT NOT NULL,
    "keywords" TEXT[],
    "color" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_action_types_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "custom_action_types_userId_slug_key" ON "custom_action_types"("userId", "slug");
CREATE INDEX "custom_action_types_userId_is_active_idx" ON "custom_action_types"("userId", "is_active");

ALTER TABLE "custom_action_types" ADD CONSTRAINT "custom_action_types_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. Étendre la table actions avec les colonnes snapshot (nullable)
ALTER TABLE "actions" ADD COLUMN "custom_type_id" TEXT;
ALTER TABLE "actions" ADD COLUMN "custom_type_label" VARCHAR(50);
ALTER TABLE "actions" ADD COLUMN "custom_type_color" TEXT;

-- 4. FK Action → CustomActionType (SetNull pour préserver l'historique)
ALTER TABLE "actions" ADD CONSTRAINT "actions_custom_type_id_fkey"
  FOREIGN KEY ("custom_type_id") REFERENCES "custom_action_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 5. Index pour filtres mixtes natif + custom
CREATE INDEX "actions_userId_status_type_custom_type_id_idx"
  ON "actions"("userId", "status", "type", "custom_type_id");
