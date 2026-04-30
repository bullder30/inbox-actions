-- Ajout de la trace de détection : segment matché + position + libellé déclencheur
-- Permet d'afficher le passage exact qui a déclenché l'action (highlight UI)
-- au lieu de la phrase entière.

ALTER TABLE "actions"
  ADD COLUMN "matched_segment" TEXT,
  ADD COLUMN "match_start"     INTEGER,
  ADD COLUMN "match_end"       INTEGER,
  ADD COLUMN "trigger_label"   VARCHAR(200);
