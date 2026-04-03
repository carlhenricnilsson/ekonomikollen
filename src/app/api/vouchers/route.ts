import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

// GET: Lista alla vouchers
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('vouchers')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Kunde inte hämta vouchers' }, { status: 500 })
  }

  return NextResponse.json({ vouchers: data })
}

// POST: Skapa ny voucher
export async function POST(req: NextRequest) {
  const { code, discount_percent, max_uses, valid_until, created_by } = await req.json()

  if (!code) {
    return NextResponse.json({ error: 'Kod krävs' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('vouchers')
    .insert({
      code: code.toUpperCase(),
      discount_percent: discount_percent ?? 100,
      max_uses: max_uses ?? 1,
      valid_until: valid_until || null,
      created_by,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Koden finns redan' }, { status: 400 })
    }
    console.error('Voucher error:', error)
    return NextResponse.json({ error: 'Kunde inte skapa voucher' }, { status: 500 })
  }

  return NextResponse.json({ voucher: data })
}
