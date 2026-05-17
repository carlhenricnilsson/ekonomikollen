import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

type Action = 'archive' | 'restore' | 'hard_delete'
type Scope = 'survey' | 'brf'

// Normaliserar BRF-namn → basnamn (utan årtal på slutet)
function baseName(brfName: string | null): string {
  if (!brfName) return ''
  return brfName.replace(/\s+\d{4}$/, '').trim()
}

export async function POST(req: NextRequest) {
  // --- 1. Server-side superadmin-verifiering (lita ALDRIG på klienten) ---
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return NextResponse.json({ error: 'Ej inloggad' }, { status: 401 })
  }

  const supabaseUser = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    { global: { headers: { Authorization: authHeader } } }
  )
  const { data: { user } } = await supabaseUser.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Ogiltig session' }, { status: 401 })
  }

  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'superadmin') {
    return NextResponse.json({ error: 'Endast superadmin' }, { status: 403 })
  }

  // --- 2. Parsa body ---
  const body = await req.json()
  const action = body.action as Action
  const scope = body.scope as Scope
  const surveyId = body.survey_id as string | undefined
  const brfBaseName = body.brf_base_name as string | undefined
  const confirmName = (body.confirm_name as string | undefined)?.trim() ?? ''
  const force = body.force === true

  if (!['archive', 'restore', 'hard_delete'].includes(action)) {
    return NextResponse.json({ error: 'Ogiltig action' }, { status: 400 })
  }
  if (!['survey', 'brf'].includes(scope)) {
    return NextResponse.json({ error: 'Ogiltig scope' }, { status: 400 })
  }

  // --- 3. Lös ut målenkäter + förväntat bekräftelsenamn ---
  let targetIds: string[] = []
  let expectedConfirm = ''

  if (scope === 'survey') {
    if (!surveyId) {
      return NextResponse.json({ error: 'survey_id krävs' }, { status: 400 })
    }
    const { data: survey } = await supabaseAdmin
      .from('surveys')
      .select('id, brf_name, survey_year, deleted_at')
      .eq('id', surveyId)
      .single()

    if (!survey) {
      return NextResponse.json({ error: 'Enkäten finns inte' }, { status: 404 })
    }
    targetIds = [survey.id]
    expectedConfirm = (survey.brf_name ?? `Enkät ${survey.survey_year}`).trim()

    if (action === 'archive' && survey.deleted_at) {
      return NextResponse.json({ error: 'Enkäten är redan arkiverad' }, { status: 409 })
    }
    if (action === 'restore' && !survey.deleted_at) {
      return NextResponse.json({ error: 'Enkäten är inte arkiverad' }, { status: 409 })
    }
    if (action === 'hard_delete' && !survey.deleted_at) {
      return NextResponse.json(
        { error: 'Enkäten måste arkiveras innan den kan raderas permanent' },
        { status: 409 }
      )
    }
  } else {
    // scope === 'brf'
    if (!brfBaseName) {
      return NextResponse.json({ error: 'brf_base_name krävs' }, { status: 400 })
    }
    const { data: allSurveys } = await supabaseAdmin
      .from('surveys')
      .select('id, brf_name, deleted_at')

    const matching = (allSurveys ?? []).filter(
      (s: { brf_name: string | null }) => baseName(s.brf_name) === brfBaseName.trim()
    )

    if (matching.length === 0) {
      return NextResponse.json({ error: 'Ingen BRF matchar' }, { status: 404 })
    }

    // Begränsa till relevanta enkäter beroende på action
    let relevant = matching
    if (action === 'archive') {
      relevant = matching.filter((s: { deleted_at: string | null }) => !s.deleted_at)
    } else if (action === 'restore') {
      relevant = matching.filter((s: { deleted_at: string | null }) => s.deleted_at)
    } else if (action === 'hard_delete') {
      // Endast redan arkiverade får raderas permanent
      relevant = matching.filter((s: { deleted_at: string | null }) => s.deleted_at)
    }

    if (relevant.length === 0) {
      return NextResponse.json(
        { error: 'Inga enkäter i rätt status för denna åtgärd' },
        { status: 409 }
      )
    }
    targetIds = relevant.map((s: { id: string }) => s.id)
    expectedConfirm = brfBaseName.trim()
  }

  // --- 4. Bekräftelsenamn måste matcha exakt (case-insensitivt) ---
  if (confirmName.toLowerCase() !== expectedConfirm.toLowerCase()) {
    return NextResponse.json(
      { error: `Bekräftelsenamnet matchar inte. Skriv exakt: "${expectedConfirm}"` },
      { status: 400 }
    )
  }

  // --- 5. Utför åtgärden ---
  if (action === 'archive') {
    const { error } = await supabaseAdmin
      .from('surveys')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', targetIds)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, archived: targetIds.length })
  }

  if (action === 'restore') {
    const { error } = await supabaseAdmin
      .from('surveys')
      .update({ deleted_at: null })
      .in('id', targetIds)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, restored: targetIds.length })
  }

  // action === 'hard_delete'
  // Kolla om någon enkät har en genomförd betalning
  const { data: paidPayments } = await supabaseAdmin
    .from('payments')
    .select('id, survey_id')
    .in('survey_id', targetIds)
    .eq('status', 'completed')

  const hasPaidReport = (paidPayments?.length ?? 0) > 0
  if (hasPaidReport && !force) {
    return NextResponse.json(
      {
        error: 'paid_report',
        message:
          `${paidPayments!.length} av enkäterna har en betald rapport. ` +
          'Permanent radering tar även bort betalningsposten (bokföringsdata). ' +
          'Bekräfta med force=true för att fortsätta.',
        paid_count: paidPayments!.length,
      },
      { status: 409 }
    )
  }

  // Radera relaterad data i rätt ordning (payments cascade:ar men vi gör det explicit)
  const childTables = ['ai_analyses', 'kpi_results', 'answers', 'payments'] as const
  for (const table of childTables) {
    const { error } = await supabaseAdmin.from(table).delete().in('survey_id', targetIds)
    if (error) {
      return NextResponse.json(
        { error: `Fel vid radering av ${table}: ${error.message}` },
        { status: 500 }
      )
    }
  }

  const { error: surveyErr } = await supabaseAdmin
    .from('surveys')
    .delete()
    .in('id', targetIds)
  if (surveyErr) {
    return NextResponse.json({ error: surveyErr.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    hard_deleted: targetIds.length,
    paid_reports_removed: paidPayments?.length ?? 0,
  })
}
