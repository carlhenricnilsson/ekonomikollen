import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabaseAdmin } from '@/lib/supabase-server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Ingen Stripe-signatur' }, { status: 400 })
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('STRIPE_WEBHOOK_SECRET saknas i miljövariabler')
    return NextResponse.json({ error: 'Webhook ej konfigurerad' }, { status: 500 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Okänt fel'
    console.error('Webhook-signaturfel:', message)
    return NextResponse.json({ error: `Webhook-fel: ${message}` }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const { survey_id, user_id, voucher_id } = session.metadata ?? {}

    if (!survey_id || !user_id) {
      console.error('Saknar metadata i Stripe-session:', session.id)
      return NextResponse.json({ error: 'Saknar metadata' }, { status: 400 })
    }

    // Markera betalningen som completed
    const { error: paymentError } = await supabaseAdmin
      .from('payments')
      .update({
        status: 'completed',
        stripe_session_id: session.id,
        stripe_payment_intent_id:
          typeof session.payment_intent === 'string' ? session.payment_intent : null,
        paid_at: new Date().toISOString(),
      })
      .eq('user_id', user_id)
      .eq('survey_id', survey_id)

    if (paymentError) {
      console.error('Kunde inte uppdatera betalning:', paymentError)
      return NextResponse.json({ error: 'Databasfel' }, { status: 500 })
    }

    // Öka voucher-användningen om en rabattkod användes
    if (voucher_id) {
      const { data: voucher } = await supabaseAdmin
        .from('vouchers')
        .select('times_used')
        .eq('id', voucher_id)
        .single()

      if (voucher) {
        await supabaseAdmin
          .from('vouchers')
          .update({ times_used: voucher.times_used + 1 })
          .eq('id', voucher_id)
      }
    }

    console.log(`Betalning genomförd: user=${user_id}, survey=${survey_id}, session=${session.id}`)
  }

  return NextResponse.json({ received: true })
}
