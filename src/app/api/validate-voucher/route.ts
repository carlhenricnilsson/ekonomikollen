import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const { code } = await req.json()

  if (!code) {
    return NextResponse.json({ error: 'Kod krävs' }, { status: 400 })
  }

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
