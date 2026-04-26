-- Migration : extend CustomActionType for regex-power
-- ATTENTION: ALTER TYPE est non-transactionnel sur Postgres → déployer avant code applicatif

-- 1. Nouvel enum CustomActionTypeMode
CREATE TYPE "CustomActionTypeMode" AS ENUM ('KEYWORDS', 'REGEX');

-- 2. Ajouter les 3 nouvelles colonnes (defaults garantissent la rétro-compat)
ALTER TABLE "custom_action_types"
  ADD COLUMN "mode" "CustomActionTypeMode" NOT NULL DEFAULT 'KEYWORDS',
  ADD COLUMN "regex_pattern" VARCHAR(200),
  ADD COLUMN "validated" BOOLEAN NOT NULL DEFAULT false;

-- 3. Marquer les types existants en mode KEYWORDS comme validated=true
--    (ils sont passés par l'ancienne validation, donc considérés sûrs)
UPDATE "custom_action_types" SET "validated" = true WHERE "mode" = 'KEYWORDS';

-- 4. Étendre l'index pour la query extracteur (filter on validated)
DROP INDEX IF EXISTS "custom_action_types_userId_is_active_idx";
CREATE INDEX "custom_action_types_userId_is_active_validated_idx"
  ON "custom_action_types"("userId", "is_active", "validated");
