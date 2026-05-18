-- ============================================================
-- 006 – RLS-HÄRDNING (säkerhetsnät)
-- ============================================================
-- Appen kör allt server-/API-arbete via service_role-nyckeln
-- (supabaseAdmin), som ALLTID kringgår RLS. RLS-policys gäller
-- därför enbart den publika "publishable"-nyckeln i webbläsaren
-- (rollerna `authenticated` och `anon`).
--
-- Klientens FAKTISKA åtkomst (enda .from()-anropen i src/app,
-- introspekterat 2026-05-18 + verifierat mot koden):
--   • user_profiles   – SELECT egen rad (login + admin: .eq('id', user.id))
--   • brf_admin_brfs   – SELECT egna rader (survey: .eq('user_id', user.id))
--   • surveys          – SELECT alla (admin-översikt, superadmin-grindad)
--   • kpi_results      – SELECT alla (nästlat i admin: surveys(*, kpi_results(*)))
--   • payments         – SELECT egna + alla för superadmin (admin: raderingsvarning)
--   • invitations      – SELECT egen e-post (bevaras, redan korrekt scopat)
-- Inga klient-skrivningar förekommer (alla insert/update/delete går
-- via API/service_role). Övriga tabeller (answers, ai_analyses,
-- brfs, organizations, vouchers) läses/skrivs ALDRIG av klienten.
--
-- Sårbarheter som stängs (live-introspektion 2026-05-18):
--   🔴 user_profiles: policy "Service role kan hantera profiler"
--      var [ALL authenticated] USING true  → vilken inloggad
--      användare som helst kunde sätta role='superadmin' på sig
--      själv (privilegie-eskalering → full data + admin).
--   🟠 surveys/answers/kpi_results/ai_analyses/brfs/organizations:
--      [SELECT authenticated] USING true → läsning av ALLA BRF:ers
--      data tvärs över föreningar.
--   🟠 surveys/answers/kpi_results/ai_analyses: [INSERT anon]
--      USING true → vem som helst kunde injicera rader.
--   🟡 vouchers: vouchers_read [SELECT public] USING true → vem
--      som helst kunde lista alla 100%-rabattkoder (gratis rapport).
--
-- Modell efter denna migration:
--   • RLS PÅ för alla tabeller (redan, görs idempotent ändå).
--   • Endast de minimalt nödvändiga SELECT-policyerna återskapas
--     för `authenticated`. Inga anon-policys. Inga skrivpolicys.
--   • Tabeller utan policy → RLS nekar publishable-klienten helt
--     (service_role påverkas ej och driver alla server-flöden).
--
-- Idempotent: funktionen är CREATE OR REPLACE; ENABLE RLS är en
-- no-op om redan på; ALLA befintliga policys på de 11 tabellerna
-- droppas dynamiskt innan minimi-uppsättningen skapas, så filen
-- kan köras om utan att policys ackumuleras eller krockar.
-- Kör i Supabase SQL Editor.
-- ============================================================

-- --------------------------------------------------------
-- Hjälpfunktion: är inloggad användare superadmin?
-- SECURITY DEFINER → kör som ägaren och kringgår RLS internt,
-- vilket bryter rekursionen (en policy på user_profiles som
-- annars skulle fråga user_profiles igen). STABLE + låst
-- search_path för säkerhet.
-- --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_superadmin()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'superadmin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_superadmin() FROM public;
GRANT EXECUTE ON FUNCTION public.is_superadmin() TO authenticated;

-- --------------------------------------------------------
-- Säkerställ RLS PÅ för samtliga tabeller (idempotent)
-- --------------------------------------------------------
ALTER TABLE public.organizations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brfs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surveys         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_results     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analyses     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brf_admin_brfs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vouchers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations     ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------
-- Droppa ALLA befintliga policys på de berörda tabellerna
-- (dynamiskt → behöver inte känna till varje namn; gör filen
-- helt omkörbar och städar bort de över-tillåtande policyerna).
-- --------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'organizations','brfs','user_profiles','surveys','answers',
        'kpi_results','ai_analyses','brf_admin_brfs','payments',
        'vouchers','invitations'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
                   r.policyname, r.schemaname, r.tablename);
  END LOOP;
END$$;

-- --------------------------------------------------------
-- Minimi-uppsättning: endast vad publishable-klienten behöver.
-- Allt är SELECT för `authenticated`. Inga anon-policys, inga
-- skrivpolicys (alla writes går via service_role som ej omfattas).
-- --------------------------------------------------------

-- user_profiles: läs ENBART din egen rad. Ingen skrivpolicy →
-- ingen roll-eskalering möjlig via publishable-nyckeln.
CREATE POLICY user_profiles_select_own ON public.user_profiles
  FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()));

-- brf_admin_brfs: en brf_admin ser sina egna BRF-kopplingar.
CREATE POLICY brf_admin_brfs_select_own ON public.brf_admin_brfs
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- surveys: endast superadmin (admin-översikten läser alla;
-- brf_admin/respondent-flöden går via API/service_role).
CREATE POLICY surveys_select_superadmin ON public.surveys
  FOR SELECT TO authenticated
  USING ((SELECT public.is_superadmin()));

-- kpi_results: endast superadmin (nästlat i admin-survey-frågan).
CREATE POLICY kpi_results_select_superadmin ON public.kpi_results
  FOR SELECT TO authenticated
  USING ((SELECT public.is_superadmin()));

-- payments: egen rad ELLER superadmin (admin läser alla 'completed'
-- för raderingsvarning; bevarar tidigare egen-rad-beteende).
CREATE POLICY payments_select_own_or_superadmin ON public.payments
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_superadmin()));

-- invitations: se enbart inbjudningar till din egen e-post
-- (bevaras – var redan korrekt scopat, ingen sårbarhet).
CREATE POLICY invitations_select_own_email ON public.invitations
  FOR SELECT TO authenticated
  USING (email = (SELECT email FROM auth.users WHERE id = (SELECT auth.uid())));

-- answers, ai_analyses, brfs, organizations, vouchers:
-- MEDVETET inga policys. RLS är på → publishable-klienten nekas
-- all åtkomst (klienten rör aldrig dessa tabeller). service_role
-- (alla API-routes) kringgår RLS och fungerar oförändrat.

-- --------------------------------------------------------
-- GRANTS lämnas orörda (sätts i migration 003). RLS är den
-- faktiska grinden: en tabell med GRANT men utan policy nekar
-- ändå publishable-klienten (deny-by-default). Defense-in-depth.
-- --------------------------------------------------------
