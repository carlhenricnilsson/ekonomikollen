import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase-server', async () => {
  const h = await import('@/test/route-helpers')
  return { supabaseAdmin: h.supabaseAdmin }
})

import { POST } from './route'
import { setSpec, makeReq } from '@/test/route-helpers'
import { __resetRateLimit } from '@/lib/rate-limit'

const future = new Date(Date.now() + 86400000).toISOString()
const past = new Date(Date.now() - 86400000).toISOString()

beforeEach(() => __resetRateLimit())

describe('POST /api/validate-voucher', () => {
  it('saknad kod → 400', async () => {
    setSpec({})
    const res = await POST(makeReq({ body: {} }))
    expect(res.status).toBe(400)
  })

  it('okänd kod → valid:false "Ogiltig kod"', async () => {
    setSpec({ vouchers: () => ({ data: null }) })
    const res = await POST(makeReq({ body: { code: 'NOPE' } }))
    const j = await res.json()
    expect(j).toEqual({ valid: false, error: 'Ogiltig kod' })
  })

  it('utgången kod → valid:false "Koden har gått ut"', async () => {
    setSpec({ vouchers: () => ({ data: { id: 'v1', discount_percent: 100, valid_until: past, max_uses: 1, times_used: 0 } }) })
    const res = await POST(makeReq({ body: { code: 'OLD' } }))
    expect((await res.json()).error).toBe('Koden har gått ut')
  })

  it('förbrukad kod → valid:false', async () => {
    setSpec({ vouchers: () => ({ data: { id: 'v1', discount_percent: 100, valid_until: null, max_uses: 1, times_used: 1 } }) })
    const j = await (await POST(makeReq({ body: { code: 'USED' } }))).json()
    expect(j.valid).toBe(false)
  })

  it('giltig 100% → final_price 0', async () => {
    setSpec({ vouchers: () => ({ data: { id: 'v1', discount_percent: 100, valid_until: future, max_uses: 5, times_used: 1 } }) })
    const j = await (await POST(makeReq({ body: { code: 'gratis' } }))).json()
    expect(j).toMatchObject({ valid: true, original_price: 5995, final_price: 0, discount_percent: 100 })
  })

  it('giltig 50% → final_price 2998 (avrundat)', async () => {
    setSpec({ vouchers: () => ({ data: { id: 'v2', discount_percent: 50, valid_until: null, max_uses: null, times_used: 0 } }) })
    const j = await (await POST(makeReq({ body: { code: 'HALVA' } }))).json()
    expect(j.final_price).toBe(2998) // round(5995 * 0.5) = round(2997.5) = 2998
  })
})
