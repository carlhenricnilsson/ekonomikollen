// Rena typer och hjälpfunktioner utbrutna ur admin/page.tsx
// (beteendebevarande – ingen logik ändrad, bara flyttad hit).

export type Survey = {
  id: string
  survey_year: number
  status: string
  brf_name: string | null
  token: string
  version: number | null
  created_at: string
  deleted_at: string | null
  kpi_results: { kpi_number: number; value: number; traffic_light: string }[]
}

export type ConfirmState = {
  action: 'archive' | 'restore' | 'hard_delete'
  scope: 'survey' | 'brf'
  surveyId?: string
  brfBaseName?: string
  expectedName: string
  label: string
  paidCount: number
} | null

// Konfidensindikator-färg (PDF-extraktion)
export function confColor(level: string) {
  if (level === 'high') return 'text-green-400'
  if (level === 'medium') return 'text-yellow-400'
  return 'text-red-400'
}

export function confLabel(level: string) {
  if (level === 'high') return 'Säker'
  if (level === 'medium') return 'Osäker'
  return 'Gissning'
}

// Trafikljus-prick → tailwind-klass
export function lightDot(light: string) {
  if (light === 'red') return 'bg-red-400'
  if (light === 'yellow') return 'bg-yellow-400'
  if (light === 'green') return 'bg-green-400'
  return 'bg-blue-400'
}
