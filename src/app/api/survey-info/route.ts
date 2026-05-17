import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({})

  const { data } = await supabaseAdmin
    .from('surveys')
    .select('brf_name, status, deleted_at')
    .eq('token', token)
    .single()

  // Arkiverade enkäter ska inte gå att fylla i
  if (!data || data.deleted_at) return NextResponse.json({})

  return NextResponse.json({ brf_name: data.brf_name, status: data.status })
}
