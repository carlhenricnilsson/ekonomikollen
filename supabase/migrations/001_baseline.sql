-- ============================================================
-- 001 – SCHEMA-BASLINJE
-- ============================================================
-- Bastabellerna skapades ursprungligen manuellt i Supabase-
-- dashboarden och saknade migration. Denna fil fångar deras
-- nuvarande exakta struktur (introspekterad från live-DB
-- 2026-05-18) så att hela databasen kan återskapas reproducerbart
-- från repo: 001 → 002 → 003 → 004 → 005.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS. Mot befintlig live-DB
-- är detta en no-op. På en tom DB skapas tabellerna; efterföljande
-- migrationer (002 ALTER user_profiles, 004 deleted_at, 005 unika
-- index) är alla IF NOT EXISTS och blir då no-ops eller additiva.
--
-- Beroendeordning: organizations → brfs → {user_profiles, surveys}
--                   → {answers, kpi_results, ai_analyses}
-- (auth.users hanteras av Supabase och finns alltid.)
--
-- Kolumner som historiskt lagts till av senare migrationer är
-- markerade nedan men ingår här eftersom denna fil speglar
-- DB:ns NUVARANDE struktur (senare ALTER blir no-op).
--
-- RLS/policies hanteras separat (appen använder service-role som
-- kringgår RLS; behörigheter sätts i migration 003). Denna fil
-- omfattar enbart tabellstruktur + constraints.
-- ============================================================

-- --------------------------------------------------------
-- organizations (rot – nätverk/enskild)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS organizations (
  id         uuid NOT NULL DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  type       text NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT organizations_pkey PRIMARY KEY (id),
  CONSTRAINT organizations_type_check CHECK (type = ANY (ARRAY['network'::text, 'individual'::text]))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;

-- --------------------------------------------------------
-- brfs (bostadsrättsförening, hör till en organization)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS brfs (
  id              uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid,
  name            text NOT NULL,
  org_number      text,
  created_at      timestamptz DEFAULT now(),
  CONSTRAINT brfs_pkey PRIMARY KEY (id),
  CONSTRAINT brfs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brfs TO authenticated;

-- --------------------------------------------------------
-- user_profiles (1:1 med auth.users; roll + ev. BRF-koppling)
-- display_name/phone tillkom historiskt via migration 002.
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_profiles (
  id           uuid NOT NULL,
  role         text NOT NULL,
  brf_id       uuid,
  full_name    text,
  created_at   timestamptz DEFAULT now(),
  display_name text,
  phone        text,
  CONSTRAINT user_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT user_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id),
  CONSTRAINT user_profiles_brf_id_fkey FOREIGN KEY (brf_id) REFERENCES brfs(id),
  CONSTRAINT user_profiles_role_check CHECK (role = ANY (ARRAY['superadmin'::text, 'brf_admin'::text, 'respondent'::text]))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_profiles TO authenticated;

-- --------------------------------------------------------
-- surveys (enkät/rapport för en BRF)
-- deleted_at tillkom historiskt via migration 004.
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS surveys (
  id           uuid NOT NULL DEFAULT gen_random_uuid(),
  brf_id       uuid,
  survey_year  integer NOT NULL,
  status       text DEFAULT 'open'::text,
  token        text DEFAULT (gen_random_uuid())::text,
  created_at   timestamptz DEFAULT now(),
  completed_at timestamptz,
  brf_name     text,
  version      integer DEFAULT 1,
  deleted_at   timestamptz,
  CONSTRAINT surveys_pkey PRIMARY KEY (id),
  CONSTRAINT surveys_token_key UNIQUE (token),
  CONSTRAINT surveys_brf_id_fkey FOREIGN KEY (brf_id) REFERENCES brfs(id),
  CONSTRAINT surveys_status_check CHECK (status = ANY (ARRAY['draft'::text, 'open'::text, 'completed'::text]))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.surveys TO authenticated;

-- --------------------------------------------------------
-- answers (svar per enkät)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS answers (
  id             uuid NOT NULL DEFAULT gen_random_uuid(),
  survey_id      uuid NOT NULL,
  question_code  text NOT NULL,
  answer_numeric numeric,
  answer_text    text,
  answer_choice  text,
  created_at     timestamptz DEFAULT now(),
  CONSTRAINT answers_pkey PRIMARY KEY (id),
  CONSTRAINT answers_survey_id_fkey FOREIGN KEY (survey_id) REFERENCES surveys(id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.answers TO authenticated;

-- --------------------------------------------------------
-- kpi_results (beräknade nyckeltal per enkät)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS kpi_results (
  id            uuid NOT NULL DEFAULT gen_random_uuid(),
  survey_id     uuid NOT NULL,
  kpi_number    integer NOT NULL,
  kpi_name      text NOT NULL,
  value         numeric NOT NULL,
  unit          text,
  traffic_light text,
  created_at    timestamptz DEFAULT now(),
  CONSTRAINT kpi_results_pkey PRIMARY KEY (id),
  CONSTRAINT kpi_results_survey_id_fkey FOREIGN KEY (survey_id) REFERENCES surveys(id),
  CONSTRAINT kpi_results_traffic_light_check CHECK (traffic_light = ANY (ARRAY['red'::text, 'yellow'::text, 'green'::text]))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kpi_results TO authenticated;

-- --------------------------------------------------------
-- ai_analyses (AI-genererad analys per enkät)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_analyses (
  id              uuid NOT NULL DEFAULT gen_random_uuid(),
  survey_id       uuid NOT NULL,
  analysis_text   text,
  recommendations text,
  language        text DEFAULT 'sv'::text,
  created_at      timestamptz DEFAULT now(),
  CONSTRAINT ai_analyses_pkey PRIMARY KEY (id),
  CONSTRAINT ai_analyses_survey_id_fkey FOREIGN KEY (survey_id) REFERENCES surveys(id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_analyses TO authenticated;

-- Inga explicita CREATE INDEX här: PK/UNIQUE skapar sina index
-- automatiskt. Perf-/unika tilläggsindex ägs av migration 004
-- (idx_surveys_deleted_at) och 005 (idx_kpi_results_survey_kpi,
-- idx_answers_survey_question).
