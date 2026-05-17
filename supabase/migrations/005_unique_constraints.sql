-- ============================================================
-- DB-skyddsnät mot dubbletter (svar & nyckeltal per enkät)
-- Kompletterar kodfixen (idempotent inlämning, commit aeb1faf):
-- även om en dubblett-insert någonsin skulle försökas avvisar
-- databasen den nu på DB-nivå (bälte och hängslen).
--
-- Förkontrollerat: 0 befintliga dubbletter i båda tabellerna
-- 2026-05-17 → unika index kan skapas utan konflikt.
-- Kör i Supabase SQL Editor.
-- ============================================================

-- Ett KPI-resultat per (enkät, nyckeltalsnummer)
CREATE UNIQUE INDEX IF NOT EXISTS idx_kpi_results_survey_kpi
  ON kpi_results(survey_id, kpi_number);

-- Ett svar per (enkät, frågekod)
CREATE UNIQUE INDEX IF NOT EXISTS idx_answers_survey_question
  ON answers(survey_id, question_code);

-- Inga nya tabeller → inga nya GRANT-satser krävs
-- (kolumnerna omfattas av befintliga tabell-grants, migration 003).
