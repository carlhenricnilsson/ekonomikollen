import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { parseBody, moneyUnlockSchema } from '@/lib/validation'
import { rateLimit } from '@/lib/rate-limit'

const REPORT_PRICE = 5995

export async function POST(req: NextRequest) {
  // Skydd mot brute-force/abuse av voucher-inlösen (gratis rapport).
  const limited = rateLimit(req, 'unlock-report', 8, 60_000)
  if (limited) return limited

  const parsed = parseBody(moneyUnlockSchema, await req.json())
  if (!parsed.ok) return parsed.res
  const { user_id, survey_id, voucher_code } = parsed.data

  // Blockera upplåsning av arkiverad enkät
  const { data: surveyRow } = await supabaseAdmin
    .from('surveys')
    .select('deleted_at')
    .eq('id', survey_id)
    .single()

  if (!surveyRow || surveyRow.deleted_at) {
    return NextResponse.json({ error: 'Enkäten är inte tillgänglig' }, { status: 404 })
  }

  // Kolla om redan upplåst
  const { data: existingPayment } = await supabaseAdmin
    .from('payments')
    .select('id')
    .eq('user_id', user_id)
    .eq('survey_id', survey_id)
    .eq('status', 'completed')
    .limit(1)

  if (existingPayment && existingPayment.length > 0) {
    return NextResponse.json({ unlocked: true, already_paid: true })
  }

  // Om voucher-kod: validera och eventuellt lås upp direkt
  if (voucher_code) {
    const { data: voucher } = await supabaseAdmin
      .from('vouchers')
      .select('*')
      .eq('code', voucher_code.toUpperCase())
      .single()

    if (!voucher) {
      return NextResponse.json({ error: 'Ogiltig rabattkod' }, { status: 400 })
    }

    if (voucher.valid_until && new Date(voucher.valid_until) < new Date()) {
      return NextResponse.json({ error: 'Rabattkoden har gått ut' }, { status: 400 })
    }

    if (voucher.max_uses && voucher.times_used >= voucher.max_uses) {
      return NextResponse.json({ error: 'Rabattkoden har redan använts maximalt antal gånger' }, { status: 400 })
    }

    const finalPrice = Math.round(REPORT_PRICE * (1 - voucher.discount_percent / 100))

    if (finalPrice === 0) {
      // Helt gratis – lås upp direkt
      const { error: payErr } = await supabaseAdmin.from('payments').insert({
        user_id,
        survey_id,
        amount_sek: 0,
        status: 'completed',
        voucher_id: voucher.id,
        paid_at: new Date().toISOString(),
      })
      if (payErr) {
        console.error('Gratis-upplåsning misslyckades:', payErr)
        return NextResponse.json({ error: 'Kunde inte låsa upp rapporten' }, { status: 500 })
      }

      // Öka times_used (best-effort – upplåsningen är redan sparad)
      await supabaseAdmin
        .from('vouchers')
        .update({ times_used: voucher.times_used + 1 })
        .eq('id', voucher.id)

      return NextResponse.json({ unlocked: true, final_price: 0 })
    }

    // Reducerat pris (partiell rabatt) – kräver betalning.
    // Frontend (redeemVoucher) skickar voucher-koden vidare till
    // /api/create-checkout-session som skapar Stripe-sessionen.
    return NextResponse.json({
      unlocked: false,
      final_price: finalPrice,
      requires_payment: true,
    })
  }

  // Ingen voucher – fullt pris, kräver betalning.
  // Frontend redirectar till Stripe via /api/create-checkout-session.
  return NextResponse.json({
    unlocked: false,
    final_price: REPORT_PRICE,
    requires_payment: true,
  })
}

// GET: Kolla om en rapport är upplåst
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const user_id = url.searchParams.get('user_id')
  const survey_id = url.searchParams.get('survey_id')

  if (!user_id || !survey_id) {
    return NextResponse.json({ unlocked: false })
  }

  const { data } = await supabaseAdmin
    .from('payments')
    .select('id')
    .eq('user_id', user_id)
    .eq('survey_id', survey_id)
    .eq('status', 'completed')
    .limit(1)

  return NextResponse.json({ unlocked: (data && data.length > 0) || false })
}
