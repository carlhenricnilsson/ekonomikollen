import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

// Normaliserar BRF-namn: "brf-spettet7 2025" → { name: "BRF Spettet7", year: 2025 }
function normalizeBrfName(raw: string): { name: string; year: number | null } {
  let s = raw.trim()

  // Extrahera år (4-siffrig 1900–2099) om det finns i strängen
  const yearMatch = s.match(/\b(19|20)\d{2}\b/)
  const year = yearMatch ? parseInt(yearMatch[0]) : null
  if (yearMatch) s = s.replace(yearMatch[0], '').trim()

  // Ta bort "BRF" / "brf" prefix med eventuellt bindestreck
  s = s.replace(/^brf[-\s]*/i, '').trim()

  // Kapitalisera varje ord (bevarar siffror och befintliga versaler)
  const words = s.split(/\s+/).filter(Boolean).map(w =>
    w.charAt(0).toUpperCase() + w.slice(1)
  )

  const name = ('BRF ' + words.join(' ')).replace(/\s+/g, ' ').trim()
  return { name, year }
}

export async function POST(req: NextRequest) {
  const { brf_name, survey_year } = await req.json()

  const normalized = brf_name ? normalizeBrfName(brf_name) : { name: null, year: null }
  const finalName = normalized.name
  const year = survey_year ?? normalized.year ?? new Date().getFullYear()
  const token = crypto.randomUUID()

  // Auto-version: räkna befintliga enkäter för samma BRF + år
  let version = 1
  if (finalName) {
    const { count } = await supabaseAdmin
      .from('surveys')
      .select('id', { count: 'exact', head: true })
      .ilike('brf_name', finalName.trim())
      .eq('survey_year', year)

    version = (count ?? 0) + 1
  }

  const { data, error } = await supabaseAdmin
    .from('surveys')
    .insert({
      survey_year: year,
      status: 'open',
      token,
      brf_name: finalName || null,
      version,
    })
    .select()
    .single()

  if (error) {
    console.error(error)
    return NextResponse.json({ error: 'Kunde inte skapa länk' }, { status: 500 })
  }

  return NextResponse.json({ token, surveyId: data.id, version, brf_name: finalName, survey_year: year })
}
