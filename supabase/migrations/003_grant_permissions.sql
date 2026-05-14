-- ============================================================
-- Explicita Data API-behörigheter för alla tabeller
-- Anledning: Fr.o.m. 2026-05-30 ger Supabase inte längre
-- automatiska grants på nya tabeller. Befintliga projekt
-- påverkas fr.o.m. 2026-10-30. Denna migration säkrar
-- samtliga befintliga tabeller och fungerar som mall för
-- framtida migreringar.
-- Kör i Supabase SQL Editor.
-- ============================================================

-- MALLEN FÖR FRAMTIDA MIGRERINGAR:
-- Efter varje CREATE TABLE, lägg alltid till:
--   GRANT SELECT, INSERT, UPDATE, DELETE ON public.<tabell> TO authenticated;
-- och om anon-åtkomst behövs:
--   GRANT SELECT, INSERT ON public.<tabell> TO anon;

-- --------------------------------------------------------
-- surveys – användare skapar och läser sina egna enkäter
-- --------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.surveys TO authenticated;

-- --------------------------------------------------------
-- answers – svar kopplade till enkäter
-- --------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.answers TO authenticated;

-- --------------------------------------------------------
-- kpi_results – beräknade nyckeltal per enkät
-- --------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kpi_results TO authenticated;

-- --------------------------------------------------------
-- ai_analyses – AI-analyser kopplade till enkäter
-- --------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_analyses TO authenticated;

-- --------------------------------------------------------
-- user_profiles – användarprofiler
-- --------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_profiles TO authenticated;

-- --------------------------------------------------------
-- payments – betalningar per rapport
-- --------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;

-- --------------------------------------------------------
-- vouchers – rabattkoder; authenticated läser, superadmin skapar
-- --------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vouchers TO authenticated;

-- --------------------------------------------------------
-- brf_admin_brfs – koppling brf_admin ↔ BRF
-- --------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brf_admin_brfs TO authenticated;

-- --------------------------------------------------------
-- invitations – inbjudningar från superadmin/admin
-- --------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitations TO authenticated;

-- --------------------------------------------------------
-- Sekvenser (UUID-generering via gen_random_uuid behöver
-- inte explicit grant, men om SERIAL-kolumner används i
-- framtiden krävs detta):
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
-- --------------------------------------------------------
