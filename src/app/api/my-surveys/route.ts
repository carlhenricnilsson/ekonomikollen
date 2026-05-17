import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { resolveUser } from '@/lib/auth'

export async function GET(req: NextRequest) {
  // Hämta den inloggade användaren via Authorization-headern (delad helper)
  const { userId } = await resolveUser(req)
  if (!userId) {
    return NextResponse.json({ surveys: [], payments: [] })
  }

  // Hämta BRF-kopplingar via admin (kringgår RLS)
  const { data: brfLinks } = await supabaseAdmin
    .from('brf_admin_brfs')
    .select('brf_base_name')
    .eq('user_id', userId)

  const brfNames = (brfLinks ?? []).map((b: { brf_base_name: string }) => b.brf_base_name)

  // Hämta alla completed surveys via admin (kringgår RLS)
  // Arkiverade enkäter (deleted_at satt) ska aldrig visas för brf_admin
  const { data: allSurveys } = await supabaseAdmin
    .from('surveys')
    .select('*, kpi_results(*)')
    .eq('status', 'completed')
    .is('deleted_at', null)

  // Filtrera på BRF-basnamn
  const matching = (allSurveys ?? []).filter((s: { brf_name: string | null }) => {
    if (!s.brf_name) return false
    const baseName = s.brf_name.replace(/\s+\d{4}$/, '').trim()
    return brfNames.includes(baseName)
  })

  matching.sort((a: { brf_name: string | null; survey_year: number }, b: { brf_name: string | null; survey_year: number }) => {
    const nameA = (a.brf_name ?? '').toLowerCase()
    const nameB = (b.brf_name ?? '').toLowerCase()
    if (nameA < nameB) return -1
    if (nameA > nameB) return 1
    return b.survey_year - a.survey_year
  })

  // Hämta betalningar för användaren via admin
  const { data: payments } = await supabaseAdmin
    .from('payments')
    .select('survey_id, status')
    .eq('user_id', userId)
    .eq('status', 'completed')

  return NextResponse.json({ surveys: matching, payments: payments ?? [], brfNames })
}
