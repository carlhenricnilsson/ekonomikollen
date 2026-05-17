import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabaseAdmin } from '@/lib/supabase-server'

// Lazy-init: skapas vid första request, inte vid build/import
function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!)
}

const REPORT_PRICE = 5995

export async function POST(req: NextRequest) {
  const { user_id, survey_id, voucher_code } = await req.json()

  // Använd request-origin för redirect-URLs (fungerar både lokalt och i prod)
  const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  if (!user_id || !survey_id) {
    return NextResponse.json({ error: 'user_id och survey_id krävs' }, { status: 400 })
  }

  // Blockera betalning av arkiverad enkät
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
    return NextResponse.json({ error: 'Rapporten är redan upplåst' }, { status: 400 })
  }

  let finalPrice = REPORT_PRICE
  let voucherId: string | null = null

  // Validera rabattkod om angiven
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
      return NextResponse.json({ error: 'Rabattkoden är förbrukad' }, { status: 400 })
    }

    finalPrice = Math.round(REPORT_PRICE * (1 - voucher.discount_percent / 100))
    voucherId = voucher.id

    if (finalPrice === 0) {
      return NextResponse.json({ error: 'Använd rabattkodsfältet för en 100%-rabatt' }, { status: 400 })
    }
  }

  // Hämta survey-namn för produktbeskrivning
  const { data: survey } = await supabaseAdmin
    .from('surveys')
    .select('brf_name, survey_year')
    .eq('id', survey_id)
    .single()

  const productName = survey?.brf_name
    ? `BRF Ekonomikollen – ${survey.brf_name} ${survey.survey_year ?? ''}`.trim()
    : 'BRF Ekonomikollen – Analysrapport'

  // Skapa Stripe Checkout-session
  const stripe = getStripe()
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'sek',
          product_data: { name: productName },
          unit_amount: finalPrice * 100, // Stripe räknar i öre
        },
        quantity: 1,
      },
    ],
    metadata: {
      survey_id,
      user_id,
      voucher_id: voucherId ?? '',
    },
    success_url: `${origin}/payment-success?survey_id=${survey_id}`,
    cancel_url: `${origin}/results/${survey_id}`,
    locale: 'sv',
  })

  // Skapa/uppdatera pending betalning i databasen
  await supabaseAdmin.from('payments').upsert(
    {
      user_id,
      survey_id,
      amount_sek: finalPrice,
      status: 'pending',
      stripe_session_id: session.id,
      voucher_id: voucherId,
    },
    { onConflict: 'user_id,survey_id' }
  )

  return NextResponse.json({ url: session.url })
}
