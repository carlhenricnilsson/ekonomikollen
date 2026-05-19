import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { requireSuperadmin } from '@/lib/auth'
import { parseBody, manageSurveySchema } from '@/lib/validation'

// Normaliserar BRF-namn → basnamn (utan årtal på slutet)
function baseName(brfName: string | null): string {
  if (!brfName) return ''
  return brfName.replace(/\s+\d{4}$/, '').trim()
}

export async function POST(req: NextRequest) {
  // --- 1. Server-side superadmin-verifiering (lita ALDRIG på klienten) ---
  const auth = await requireSuperadmin(req)
  if ('error' in auth) return auth.error

  // --- 2. Parsa + validera body (zod: action/scope-enums + typer) ---
  const parsed = parseBody(manageSurveySchema, await req.json())
  if (!parsed.ok) return parsed.res
  const { action, scope } = parsed.data
  const surveyId = parsed.data.survey_id
  const brfBaseName = parsed.data.brf_base_name
  const confirmName = parsed.data.confirm_name?.trim() ?? ''
  const force = parsed.data.force === true

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
  // Gäller endast destruktiva åtgärder (archive/hard_delete). Återställning
  // är icke-destruktiv (deleted_at → null) och UI:t döljer medvetet
  // bekräftelsefältet för restore – kräv därför inget bekräftelsenamn där,
  // annars skickar klienten alltid tom sträng och restore kan aldrig lyckas.
  if (action !== 'restore' && confirmName.toLowerCase() !== expectedConfirm.toLowerCase()) {
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
