import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase-server', async () => {
  const h = await import('@/test/route-helpers')
  return { supabaseAdmin: h.supabaseAdmin }
})
vi.mock('stripe', async () => {
  const h = await import('@/test/route-helpers')
  return { default: h.StripeMock }
})

import { POST } from './route'
import { setSpec, setStripe, makeReq, calls, QState } from '@/test/route-helpers'

beforeEach(() => {
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
  process.env.STRIPE_SECRET_KEY = 'sk_test'
})

function completedEvent(metadata: Record<string, string>) {
  return {
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_1', payment_intent: 'pi_1', metadata } },
  }
}

describe('POST /api/stripe-webhook', () => {
  it('ingen signatur → 400', async () => {
    setSpec({})
    const res = await POST(makeReq({ rawBody: '{}', headers: {} }))
    expect(res.status).toBe(400)
  })

  it('saknad STRIPE_WEBHOOK_SECRET → 500', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET
    setSpec({})
    const res = await POST(makeReq({ rawBody: '{}', headers: { 'stripe-signature': 'sig' } }))
    expect(res.status).toBe(500)
  })

  it('felaktig signatur (constructEvent kastar) → 400', async () => {
    setSpec({})
    setStripe({ constructEvent: () => { throw new Error('bad sig') } })
    const res = await POST(makeReq({ rawBody: '{}', headers: { 'stripe-signature': 'sig' } }))
    expect(res.status).toBe(400)
  })

  it('annan event-typ → received:true, ingen DB-skrivning', async () => {
    setSpec({})
    setStripe({ constructEvent: () => ({ type: 'payment_intent.created', data: { object: {} } }) })
    const res = await POST(makeReq({ rawBody: '{}', headers: { 'stripe-signature': 'sig' } }))
    expect(await res.json()).toEqual({ received: true })
    expect(calls.find(c => c.table === 'payments')).toBeUndefined()
  })

  it('checkout.session.completed utan metadata → 400', async () => {
    setSpec({})
    setStripe({ constructEvent: () => completedEvent({}) })
    const res = await POST(makeReq({ rawBody: '{}', headers: { 'stripe-signature': 'sig' } }))
    expect(res.status).toBe(400)
  })

  it('completed utan voucher → markerar payment completed (första övergången)', async () => {
    // payments-update returnerar transitionerad rad → firstTransition=true
    setSpec({ payments: (s: QState) => (s.op === 'update' ? { data: [{ id: 'p1' }] } : {}) })
    setStripe({ constructEvent: () => completedEvent({ survey_id: 's1', user_id: 'u1' }) })
    const res = await POST(makeReq({ rawBody: '{}', headers: { 'stripe-signature': 'sig' } }))
    expect(await res.json()).toEqual({ received: true })
    const upd = calls.find(c => c.table === 'payments' && c.op === 'update')
    expect((upd?.payload as { status: string }).status).toBe('completed')
    expect((upd?.payload as { stripe_payment_intent_id: string }).stripe_payment_intent_id).toBe('pi_1')
    expect(upd?.filters).toEqual(expect.arrayContaining([
      ['eq', 'user_id', 'u1'], ['eq', 'survey_id', 's1'], ['neq', 'status', 'completed'],
    ]))
  })

  it('completed med voucher_id → ökar times_used (en gång)', async () => {
    setSpec({
      payments: (s: QState) => (s.op === 'update' ? { data: [{ id: 'p1' }] } : {}),
      vouchers: (s: QState) => (s.single ? { data: { times_used: 4 } } : {}),
    })
    setStripe({ constructEvent: () => completedEvent({ survey_id: 's1', user_id: 'u1', voucher_id: 'v1' }) })
    await POST(makeReq({ rawBody: '{}', headers: { 'stripe-signature': 'sig' } }))
    const vUpd = calls.find(c => c.table === 'vouchers' && c.op === 'update')
    expect(vUpd?.payload).toEqual({ times_used: 5 }) // 4 + 1
  })

  it('IDEMPOTENS: retry/dubbelleverans (redan completed) → ingen voucher-inkrement', async () => {
    // neq('status','completed') exkluderar redan-completed → 0 rader transitionerade
    setSpec({
      payments: (s: QState) => (s.op === 'update' ? { data: [] } : {}),
      vouchers: (s: QState) => (s.single ? { data: { times_used: 4 } } : {}),
    })
    setStripe({ constructEvent: () => completedEvent({ survey_id: 's1', user_id: 'u1', voucher_id: 'v1' }) })
    const res = await POST(makeReq({ rawBody: '{}', headers: { 'stripe-signature': 'sig' } }))
    expect(await res.json()).toEqual({ received: true })
    // Voucher får INTE inkrementeras vid retry
    expect(calls.find(c => c.table === 'vouchers' && c.op === 'update')).toBeUndefined()
  })

  it('DB-fel vid payment-update → 500', async () => {
    setSpec({ payments: () => ({ error: { message: 'db down' } }) })
    setStripe({ constructEvent: () => completedEvent({ survey_id: 's1', user_id: 'u1' }) })
    const res = await POST(makeReq({ rawBody: '{}', headers: { 'stripe-signature': 'sig' } }))
    expect(res.status).toBe(500)
  })
})
