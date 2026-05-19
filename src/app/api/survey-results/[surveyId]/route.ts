import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { resolveUser } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ surveyId: string }> }
) {
  // Capability-URL: returnerar konfidentiell rapportdata till vem som
  // helst med surveyId. Throttla scraping/uppräkning. 15/min/IP är
  // rikligt för legitim lågfrekvent rapportvisning men biter rejält
  // mot automatiserad skrapning (best-effort per-instans i serverless
  // – strikt globalt tak kräver KV/Redis, se rate-limit.ts).
  const limited = rateLimit(req, 'survey-results', 15, 60_000)
  if (limited) return limited

  const { surveyId } = await params

  // Hämta inloggad användare via Authorization-header (delad helper)
  const { userId, role: userRole } = await resolveUser(req)

  // Kolla betalning / full access
  let reportUnlocked = userRole === 'superadmin'
  if (!reportUnlocked && userId) {
    const { data: payment } = await supabaseAdmin
      .from('payments')
      .select('id')
      .eq('user_id', userId)
      .eq('survey_id', surveyId)
      .eq('status', 'completed')
      .limit(1)
    reportUnlocked = (payment && payment.length > 0) || false
  }

  // Hämta survey-metadata
  const { data: surveyRow } = await supabaseAdmin
    .from('surveys')
    .select('brf_name, survey_year, version, deleted_at')
    .eq('id', surveyId)
    .single()

  // Arkiverade enkäter är endast åtkomliga för superadmin
  if (surveyRow?.deleted_at && userRole !== 'superadmin') {
    return NextResponse.json({ error: 'Enkäten är inte tillgänglig' }, { status: 404 })
  }

  // Hämta KPI-resultat
  const { data: kpiRows } = await supabaseAdmin
    .from('kpi_results')
    .select('*')
    .eq('survey_id', surveyId)
    .order('kpi_number')

  // Hämta svar
  const { data: answerRows } = await supabaseAdmin
    .from('answers')
    .select('*')
    .eq('survey_id', surveyId)

  // Hämta sparad AI-analys
  const { data: aiRows } = await supabaseAdmin
    .from('ai_analyses')
    .select('analysis_text, created_at')
    .eq('survey_id', surveyId)
    .order('created_at', { ascending: false })
    .limit(1)

  // Hämta historiska enkäter för samma BRF
  let historicalKpis: unknown[] = []
  if (surveyRow?.brf_name) {
    const baseName = surveyRow.brf_name.replace(/\s+\d{4}$/, '').trim()
    const { data: allSurveys } = await supabaseAdmin
      .from('surveys')
      .select('id, survey_year, brf_name, kpi_results(*)')
      .eq('status', 'completed')
      .is('deleted_at', null)
    historicalKpis = (allSurveys ?? [])
      .filter((s: { id: string; brf_name: string | null }) =>
        s.id !== surveyId && s.brf_name &&
        s.brf_name.replace(/\s+\d{4}$/, '').trim() === baseName
      )
      .map((s: { survey_year: number; kpi_results: unknown }) => ({
        year: s.survey_year,
        kpis: s.kpi_results,
      }))
  }

  return NextResponse.json({
    userRole,
    userId,
    reportUnlocked,
    surveyMeta: surveyRow ?? null,
    kpis: kpiRows ?? [],
    answers: answerRows ?? [],
    aiAnalysis: aiRows?.[0]?.analysis_text ?? null,
    aiSavedAt: aiRows?.[0]?.created_at ?? null,
    historicalKpis,
  })
}
