import { describe, it, expect, vi } from 'vitest'

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

const base = { body: { user_id: 'u1', survey_id: 's1' }, headers: { origin: 'https://test.app' } }
const activeSurvey = { surveys: () => ({ data: { deleted_at: null, brf_name: 'BRF Test', survey_year: 2025 } }) }
const notPaid = { payments: (s: QState) => (s.op === 'select' ? { data: [] } : {}) }

let lastSession: Record<string, unknown> | null = null
function stubStripe() {
  lastSession = null
  setStripe({
    sessionsCreate: async (args) => {
      lastSession = args as Record<string, unknown>
      return { id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' }
    },
  })
}

describe('POST /api/create-checkout-session', () => {
  it('saknade params → 400', async () => {
    setSpec({}); stubStripe()
    expect((await POST(makeReq({ body: {} }))).status).toBe(400)
  })

  it('arkiverad/saknad enkät → 404', async () => {
    setSpec({ surveys: () => ({ data: { deleted_at: '2026-01-01' } }) }); stubStripe()
    expect((await POST(makeReq(base))).status).toBe(404)
  })

  it('redan betald → 400', async () => {
    setSpec({ ...activeSurvey, payments: () => ({ data: [{ id: 'p1' }] }) }); stubStripe()
    expect((await POST(makeReq(base))).status).toBe(400)
  })

  it('ogiltig voucher → 400', async () => {
    setSpec({ ...activeSurvey, ...notPaid, vouchers: () => ({ data: null }) }); stubStripe()
    expect((await POST(makeReq({ ...base, body: { ...base.body, voucher_code: 'X' } }))).status).toBe(400)
  })

  it('100%-voucher → 400 (hänvisar till rabattkodsfältet, ej Stripe)', async () => {
    setSpec({
      ...activeSurvey, ...notPaid,
      vouchers: () => ({ data: { id: 'v', discount_percent: 100, valid_until: null, max_uses: 5, times_used: 0 } }),
    }); stubStripe()
    const res = await POST(makeReq({ ...base, body: { ...base.body, voucher_code: 'GRATIS' } }))
    expect(res.status).toBe(400)
    expect(lastSession).toBeNull() // ingen Stripe-session skapad
  })

  it('fullt pris → Stripe-session 5995 kr, pending payment upsertas', async () => {
    setSpec({ ...activeSurvey, ...notPaid }); stubStripe()
    const j = await (await POST(makeReq(base))).json()
    expect(j.url).toContain('checkout.stripe.com')
    const li = (lastSession!.line_items as { price_data: { unit_amount: number } }[])[0]
    expect(li.price_data.unit_amount).toBe(5995 * 100) // öre
    expect(lastSession!.success_url).toBe('https://test.app/payment-success?survey_id=s1')
    const upsert = calls.find(c => c.table === 'payments' && c.op === 'upsert')
    expect(upsert?.payload).toMatchObject({ status: 'pending', amount_sek: 5995, user_id: 'u1' })
  })

  it('partiell voucher (50%) → Stripe 2998 kr + voucher_id i metadata', async () => {
    setSpec({
      ...activeSurvey, ...notPaid,
      vouchers: () => ({ data: { id: 'v5', discount_percent: 50, valid_until: null, max_uses: null, times_used: 0 } }),
    }); stubStripe()
    const j = await (await POST(makeReq({ ...base, body: { ...base.body, voucher_code: 'HALVA' } }))).json()
    expect(j.url).toContain('checkout.stripe.com')
    const li = (lastSession!.line_items as { price_data: { unit_amount: number } }[])[0]
    expect(li.price_data.unit_amount).toBe(2998 * 100)
    expect((lastSession!.metadata as { voucher_id: string }).voucher_id).toBe('v5')
    const upsert = calls.find(c => c.table === 'payments' && c.op === 'upsert')
    expect(upsert?.payload).toMatchObject({ amount_sek: 2998, voucher_id: 'v5' })
  })
})
