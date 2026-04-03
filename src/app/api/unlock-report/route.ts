import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

const REPORT_PRICE = 5995

export async function POST(req: NextRequest) {
  const { user_id, survey_id, voucher_code } = await req.json()

  if (!user_id || !survey_id) {
    return NextResponse.json({ error: 'user_id och survey_id krävs' }, { status: 400 })
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
      await supabaseAdmin.from('payments').insert({
        user_id,
        survey_id,
        amount_sek: 0,
        status: 'completed',
        voucher_id: voucher.id,
        paid_at: new Date().toISOString(),
      })

      // Öka times_used
      await supabaseAdmin
        .from('vouchers')
        .update({ times_used: voucher.times_used + 1 })
        .eq('id', voucher.id)

      return NextResponse.json({ unlocked: true, final_price: 0 })
    }

    // Reducerat pris – skapa Stripe-session (förberett)
    // TODO: Stripe Checkout session med reducerat pris
    return NextResponse.json({
      unlocked: false,
      final_price: finalPrice,
      requires_payment: true,
      message: 'Stripe-integration ej konfigurerad ännu. Kontakta support.',
    })
  }

  // Fullt pris – skapa Stripe-session
  // TODO: Stripe Checkout session med fullt pris
  return NextResponse.json({
    unlocked: false,
    final_price: REPORT_PRICE,
    requires_payment: true,
    message: 'Stripe-integration ej konfigurerad ännu. Kontakta support.',
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
