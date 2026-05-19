import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { parseBody, validateVoucherSchema } from '@/lib/validation'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  // Skydd mot skriptad brute-force av lågentropi-rabattkoder
  // (en giltig 100%-kod = gratis rapport värd 5 995 kr).
  const limited = rateLimit(req, 'validate-voucher', 10, 60_000)
  if (limited) return limited

  const parsed = parseBody(validateVoucherSchema, await req.json())
  if (!parsed.ok) return parsed.res
  const { code } = parsed.data

  const { data: voucher } = await supabaseAdmin
    .from('vouchers')
    .select('*')
    .eq('code', code.toUpperCase())
    .single()

  if (!voucher) {
    return NextResponse.json({ valid: false, error: 'Ogiltig kod' })
  }

  // Kolla om utgången
  if (voucher.valid_until && new Date(voucher.valid_until) < new Date()) {
    return NextResponse.json({ valid: false, error: 'Koden har gått ut' })
  }

  // Kolla om max antal användningar nåtts
  if (voucher.max_uses && voucher.times_used >= voucher.max_uses) {
    return NextResponse.json({ valid: false, error: 'Koden har redan använts maximalt antal gånger' })
  }

  const discountedPrice = Math.round(5995 * (1 - voucher.discount_percent / 100))

  return NextResponse.json({
    valid: true,
    voucher_id: voucher.id,
    discount_percent: voucher.discount_percent,
    original_price: 5995,
    final_price: discountedPrice,
  })
}
