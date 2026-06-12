-- Doctium Scribe (Phase 1): AI-draft provenance on SOAP clinical notes.
-- aiTranscript stores the exact source text the draft was generated from
-- (chat thread or dictation transcript) so every AI-assisted note is auditable.
ALTER TABLE "clinical_notes"
  ADD COLUMN "aiDrafted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "aiDraftSource" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "aiTranscript" TEXT NOT NULL DEFAULT '';
