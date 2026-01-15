-- Migration: Remplacer processed par status et ajouter lastEmailExtractionDate
-- Date: 2026-01-07

-- 1. Créer l'enum EmailStatus
CREATE TYPE "EmailStatus" AS ENUM ('EXTRACTED', 'ANALYZED');

-- 2. Ajouter la colonne status avec une valeur par défaut temporaire
ALTER TABLE "email_metadata"
ADD COLUMN "status" "EmailStatus" NOT NULL DEFAULT 'EXTRACTED';

-- 3. Migrer les données existantes
-- Les emails déjà traités (processed = true) deviennent ANALYZED
-- Les emails non traités (processed = false) restent EXTRACTED
UPDATE "email_metadata"
SET "status" = 'ANALYZED'
WHERE "processed" = true;

-- 4. Supprimer l'ancien index sur processed
DROP INDEX IF EXISTS "email_metadata_processed_idx";

-- 5. Créer le nouvel index sur status
CREATE INDEX "email_metadata_status_idx" ON "email_metadata"("status");

-- 6. Supprimer l'ancienne colonne processed
ALTER TABLE "email_metadata" DROP COLUMN "processed";

-- 7. Ajouter lastEmailExtractionDate au modèle User
ALTER TABLE "users"
ADD COLUMN "last_email_extraction_date" TIMESTAMP(3);

-- 8. Initialiser lastEmailExtractionDate avec lastGmailSync pour les utilisateurs existants
UPDATE "users"
SET "last_email_extraction_date" = "last_gmail_sync"
WHERE "last_gmail_sync" IS NOT NULL;
