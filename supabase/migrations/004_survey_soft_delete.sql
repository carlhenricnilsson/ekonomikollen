-- ============================================================
-- Soft delete (arkivering) för enkäter
-- Superadmin kan arkivera enkäter (återställbart) och senare
-- radera permanent. Arkiverade enkäter döljs överallt i appen.
-- Kör i Supabase SQL Editor.
-- ============================================================

-- deleted_at = NULL  → aktiv enkät
-- deleted_at = tidpunkt → arkiverad (dold men återställbar)
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Index för snabb filtrering av aktiva enkäter
CREATE INDEX IF NOT EXISTS idx_surveys_deleted_at ON surveys(deleted_at);

-- --------------------------------------------------------
-- GRANTS – krävs fr.o.m. Supabase policy 2026-10-30.
-- surveys hade redan grants (migration 003), men eftersom
-- detta är en ALTER på befintlig tabell krävs inga nya
-- tabell-grants. Kolumnen omfattas av befintlig tabell-grant.
-- --------------------------------------------------------
