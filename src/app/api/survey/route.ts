import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { calculateKPIs, kpiSetToArray } from '@/lib/kpi-calculator'
import type { SurveyAnswer } from '@/types'

export async function POST(req: NextRequest) {
  const { answers, token, brf_name } = await req.json()

  // Enda KPI-sanningskällan: delade, testtäckta lib:en.
  // Mappas till routens etablerade svarsform {id,name,value,unit,light}
  // (oförändrat kontrakt för sessionStorage/results-sidan).
  const kpis = kpiSetToArray(calculateKPIs(answers as unknown as SurveyAnswer)).map(k => ({
    id: k.id,
    name: k.name_sv,
    value: k.value,
    unit: k.unit,
    light: k.traffic_light,
  }))

  let surveyId: string

  if (token) {
    // Använd befintlig enkät kopplad till token
    const { data: existing } = await supabaseAdmin
      .from('surveys')
      .select('id')
      .eq('token', token)
      .single()

    if (existing) {
      surveyId = existing.id
      await supabaseAdmin
        .from('surveys')
        .update({ status: 'completed', survey_year: Number(answers.A1_year) || new Date().getFullYear() })
        .eq('id', surveyId)
    } else {
      return NextResponse.json({ error: 'Ogiltig enkätlänk' }, { status: 400 })
    }
  } else {
    // Skapa ny enkät (direktflöde utan token)
    const surveyYear = Number(answers.A1_year) || new Date().getFullYear()
    const insertData: Record<string, unknown> = { survey_year: surveyYear, status: 'completed' }
    if (brf_name) insertData.brf_name = `${brf_name} ${surveyYear}`

    const { data: survey, error: surveyError } = await supabaseAdmin
      .from('surveys')
      .insert(insertData)
      .select()
      .single()

    if (surveyError || !survey) {
      console.error('Survey insert error:', surveyError)
      return NextResponse.json({ surveyId: crypto.randomUUID(), kpis, answers })
    }
    surveyId = survey.id
  }

  // Idempotent: rensa ev. tidigare svar/KPI för enkäten innan nya sparas.
  // Förhindrar dubbletter om samma tokenlänk lämnas in mer än en gång.
  // För en nyskapad enkät matchar detta 0 rader (no-op).
  await supabaseAdmin.from('answers').delete().eq('survey_id', surveyId)
  await supabaseAdmin.from('kpi_results').delete().eq('survey_id', surveyId)

  // Spara alla svar
  const answerRows = Object.entries(answers).map(([question_code, value]) => ({
    survey_id: surveyId,
    question_code,
    answer_numeric: typeof value === 'number' ? value : null,
    answer_text: typeof value === 'string' ? value : null,
    answer_choice: typeof value === 'boolean' ? String(value) : null,
  }))

  await supabaseAdmin.from('answers').insert(answerRows)

  // Spara KPI-resultat
  const kpiRows = kpis.map(k => ({
    survey_id: surveyId,
    kpi_number: k.id,
    kpi_name: k.name,
    value: k.value,
    unit: k.unit,
    traffic_light: k.light,
  }))

  await supabaseAdmin.from('kpi_results').insert(kpiRows)

  return NextResponse.json({ surveyId: surveyId, kpis, answers })
}
