import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase-server', async () => {
  const h = await import('@/test/route-helpers')
  return { supabaseAdmin: h.supabaseAdmin }
})

import { POST } from './route'
import { setSpec, makeReq, calls, QState } from '@/test/route-helpers'
import { __resetRateLimit } from '@/lib/rate-limit'

const base = { body: { user_id: 'u1', survey_id: 's1' } }
const activeSurvey = { surveys: () => ({ data: { deleted_at: null } }) }
const notPaid = { payments: (s: QState) => (s.op === 'select' ? { data: [] } : {}) }

beforeEach(() => __resetRateLimit())

describe('POST /api/unlock-report', () => {
  it('saknade params → 400', async () => {
    setSpec({})
    expect((await POST(makeReq({ body: {} }))).status).toBe(400)
  })

  it('enkät saknas → 404', async () => {
    setSpec({ surveys: () => ({ data: null }) })
    expect((await POST(makeReq(base))).status).toBe(404)
  })

  it('arkiverad enkät → 404', async () => {
    setSpec({ surveys: () => ({ data: { deleted_at: '2026-01-01T00:00:00Z' } }) })
    expect((await POST(makeReq(base))).status).toBe(404)
  })

  it('redan betald → unlocked:true, already_paid:true', async () => {
    setSpec({ ...activeSurvey, payments: () => ({ data: [{ id: 'p1' }] }) })
    const j = await (await POST(makeReq(base))).json()
    expect(j).toEqual({ unlocked: true, already_paid: true })
  })

  it('ingen voucher, ej betald → requires_payment fullt pris', async () => {
    setSpec({ ...activeSurvey, ...notPaid })
    const j = await (await POST(makeReq(base))).json()
    expect(j).toEqual({ unlocked: false, final_price: 5995, requires_payment: true })
  })

  it('ogiltig voucher → 400', async () => {
    setSpec({ ...activeSurvey, ...notPaid, vouchers: () => ({ data: null }) })
    const res = await POST(makeReq({ body: { ...base.body, voucher_code: 'X' } }))
    expect(res.status).toBe(400)
  })

  it('utgången voucher → 400', async () => {
    setSpec({
      ...activeSurvey, ...notPaid,
      vouchers: () => ({ data: { id: 'v', discount_percent: 100, valid_until: '2000-01-01', max_uses: 1, times_used: 0 } }),
    })
    expect((await POST(makeReq({ body: { ...base.body, voucher_code: 'OLD' } }))).status).toBe(400)
  })

  it('förbrukad voucher → 400', async () => {
    setSpec({
      ...activeSurvey, ...notPaid,
      vouchers: () => ({ data: { id: 'v', discount_percent: 100, valid_until: null, max_uses: 1, times_used: 1 } }),
    })
    expect((await POST(makeReq({ body: { ...base.body, voucher_code: 'USED' } }))).status).toBe(400)
  })

  it('100%-voucher → reserverar atomärt (rpc) + skapar completed payment', async () => {
    setSpec({
      ...activeSurvey,
      payments: (s) => (s.op === 'select' ? { data: [] } : {}),
      vouchers: (s) => (s.single ? { data: { id: 'v9', discount_percent: 100, valid_until: null, max_uses: 5, times_used: 2 } } : {}),
      redeem_voucher: () => ({ data: { ok: true, new_times_used: 3, max_uses: 5 } }),
    })
    const j = await (await POST(makeReq({ body: { ...base.body, voucher_code: 'GRATIS' } }))).json()
    expect(j).toEqual({ unlocked: true, final_price: 0 })

    const reserve = calls.find(c => c.table === 'redeem_voucher')
    expect(reserve?.payload).toEqual({ p_voucher_id: 'v9' })
    const insert = calls.find(c => c.table === 'payments' && c.op === 'insert')
    expect(insert?.payload).toMatchObject({ status: 'completed', amount_sek: 0, voucher_id: 'v9' })
  })

  it('100%-voucher men atomär reservering nekas (race/förbrukad) → 400, INGEN upplåsning', async () => {
    setSpec({
      ...activeSurvey,
      payments: (s) => (s.op === 'select' ? { data: [] } : {}),
      vouchers: (s) => (s.single ? { data: { id: 'v9', discount_percent: 100, valid_until: null, max_uses: 1, times_used: 0 } } : {}),
      redeem_voucher: () => ({ data: { ok: false, new_times_used: null, max_uses: null } }),
    })
    const res = await POST(makeReq({ body: { ...base.body, voucher_code: 'GRATIS' } }))
    expect(res.status).toBe(400)
    // Ingen completed payment fick skapas när reserveringen nekades
    expect(calls.find(c => c.table === 'payments' && c.op === 'insert')).toBeUndefined()
  })

  it('partiell voucher (50%) → requires_payment, final_price 2998', async () => {
    setSpec({
      ...activeSurvey, ...notPaid,
      vouchers: () => ({ data: { id: 'v', discount_percent: 50, valid_until: null, max_uses: null, times_used: 0 } }),
    })
    const j = await (await POST(makeReq({ body: { ...base.body, voucher_code: 'HALVA' } }))).json()
    expect(j).toEqual({ unlocked: false, final_price: 2998, requires_payment: true })
  })
})
