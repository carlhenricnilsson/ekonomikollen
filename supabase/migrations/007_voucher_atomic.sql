-- ============================================================
-- 007 – ATOMÄR VOUCHER-HANTERING (stänger TOCTOU / lost-update)
-- ============================================================
-- Tidigare: unlock-report läste times_used, kollade >= max_uses,
-- låste upp, och skrev times_used+1 (read-modify-write). Två
-- samtidiga inlösen av samma engångskod kunde båda passera kollen
-- och låsa upp gratis → flera gratis rapporter à 5 995 kr.
-- Webhookens times_used+1 hade samma lost-update vid samtidiga
-- olika betalningar på en delad fler-användnings-voucher.
--
-- redeem_voucher: ETT atomärt UPDATE med villkor + radlås.
--   0 rader = saknas/förbrukad. Används av unlock-report INNAN
--   gratis-upplåsning (reservera först, lås upp sen).
-- increment_voucher_use: atomär ovillkorlig +1 (lost-update-säker)
--   för webhooken efter en faktiskt genomförd Stripe-betalning
--   (grindad av firstTransition → exakt en gång per betalning).
--
-- SECURITY DEFINER (ägs av postgres → radlås/atomicitet garanterad,
-- kringgår RLS internt). Endast service_role (API) får EXECUTE;
-- klienten rör aldrig dessa. Idempotent: CREATE OR REPLACE +
-- DROP/GRANT. Kör i Supabase SQL Editor.
-- ============================================================

CREATE OR REPLACE FUNCTION public.redeem_voucher(p_voucher_id uuid)
  RETURNS TABLE (ok boolean, new_times_used integer, max_uses integer)
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.vouchers v
     SET times_used = v.times_used + 1
   WHERE v.id = p_voucher_id
     AND (v.max_uses IS NULL OR v.times_used < v.max_uses)
  RETURNING true, v.times_used, v.max_uses;

  -- Inga rader uppdaterade → voucher saknas eller är förbrukad
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::integer, NULL::integer;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_voucher_use(p_voucher_id uuid)
  RETURNS void
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path = public
AS $$
  UPDATE public.vouchers SET times_used = times_used + 1 WHERE id = p_voucher_id;
$$;

REVOKE ALL ON FUNCTION public.redeem_voucher(uuid)        FROM public;
REVOKE ALL ON FUNCTION public.increment_voucher_use(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.redeem_voucher(uuid)        TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_voucher_use(uuid) TO service_role;
