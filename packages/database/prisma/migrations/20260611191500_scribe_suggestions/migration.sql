-- Doctium Scribe (Phase 2): action-hub suggestions persisted with the draft so
-- the editor can re-show actionable chips after a reload. Doctor-confirmed only.
ALTER TABLE "clinical_notes"
  ADD COLUMN "aiSuggestions" JSONB NOT NULL DEFAULT '{}';
