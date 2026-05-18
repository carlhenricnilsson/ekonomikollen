import { type Survey, type ConfirmState, lightDot } from '../_helpers'

export type BrfGroup = { name: string; surveys: Survey[] }

// Grupperad enkätlista (per BRF, expanderbara fleråriga grupper).
// Rent presentationslager – all state/logik (expandera, kopiera,
// navigera, bekräfta) ägs av page.tsx och skickas in som callbacks.
export function SurveyList({
  loading,
  surveysCount,
  grouped,
  expandedBrf,
  copiedId,
  countPaid,
  onToggleExpand,
  onCopyLink,
  onView,
  onConfirm,
}: {
  loading: boolean
  surveysCount: number
  grouped: BrfGroup[]
  expandedBrf: Set<string>
  copiedId: string | null
  countPaid: (surveyIds: string[]) => number
  onToggleExpand: (name: string) => void
  onCopyLink: (surveyId: string, token: string) => void
  onView: (surveyId: string) => void
  onConfirm: (cs: NonNullable<ConfirmState>) => void
}) {
  if (loading) {
    return <div className="text-white/30 text-center py-20">Laddar...</div>
  }
  if (surveysCount === 0) {
    return (
      <div className="text-center py-20 text-white/30">
        <p className="text-lg mb-2">Inga enkäter ännu</p>
        <p className="text-sm">Enkäter visas här när BRF:er fyller i dem</p>
      </div>
    )
  }
  if (grouped.length === 0) {
    return (
      <div className="text-center py-16 text-white/30">
        <p className="text-lg mb-2">Inga träffar</p>
        <p className="text-sm">Prova ett annat sökord eller år</p>
      </div>
    )
  }
  return (
    <div className="space-y-3">
      {grouped.map(group => {
        const isMultiYear = group.surveys.length > 1
        const isExpanded = expandedBrf.has(group.name)
        const latest = group.surveys[0]
        const latestKpis = latest.kpi_results ?? []

        return (
          <div key={group.name} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            {/* Grupp-header */}
            <div
              className={`p-5 flex items-center justify-between ${isMultiYear ? 'cursor-pointer hover:bg-white/[0.03]' : ''} transition-colors`}
              onClick={() => {
                if (!isMultiYear) return
                onToggleExpand(group.name)
              }}
            >
              <div className="flex items-center gap-4">
                <div className="bg-blue-500/20 rounded-lg w-10 h-10 flex items-center justify-center text-blue-400 font-bold text-sm">
                  {latest.survey_year}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{group.name}</p>
                    {isMultiYear && (
                      <span className="text-xs bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded-full font-medium">
                        {group.surveys.length} år
                      </span>
                    )}
                    {(latest.version ?? 1) > 1 && (
                      <span className="text-xs bg-white/10 text-white/50 px-1.5 py-0.5 rounded">ver.{latest.version}</span>
                    )}
                  </div>
                  <p className="text-white/30 text-xs mt-0.5">
                    {isMultiYear
                      ? `${group.surveys[group.surveys.length - 1].survey_year}–${latest.survey_year}`
                      : `${latest.survey_year}`
                    } · <span className={latest.status === 'completed' ? 'text-green-400' : 'text-yellow-400'}>{latest.status === 'completed' ? 'Genomförd' : 'Väntar'}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                {latestKpis.length > 0 && (
                  <div className="flex items-center gap-2">
                    {[...Array(7)].map((_, i) => {
                      const kpi = latestKpis.find(k => k.kpi_number === i + 1)
                      return <div key={i} className={`w-2.5 h-2.5 rounded-full ${kpi ? lightDot(kpi.traffic_light) : 'bg-white/10'}`} />
                    })}
                  </div>
                )}
                <div className="flex gap-2 text-xs">
                  {latestKpis.filter(k => k.traffic_light === 'green').length > 0 && <span className="text-green-400">{latestKpis.filter(k => k.traffic_light === 'green').length} bra</span>}
                  {latestKpis.filter(k => k.traffic_light === 'yellow').length > 0 && <span className="text-yellow-400">{latestKpis.filter(k => k.traffic_light === 'yellow').length} bevaka</span>}
                  {latestKpis.filter(k => k.traffic_light === 'red').length > 0 && <span className="text-red-400">{latestKpis.filter(k => k.traffic_light === 'red').length} varning</span>}
                </div>
                {!isMultiYear && latest.token && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onCopyLink(latest.id, latest.token) }}
                    className={`text-xs transition-colors ${copiedId === latest.id ? 'text-green-400' : 'text-white/40 hover:text-white'}`}
                  >
                    {copiedId === latest.id ? '✓ Kopierad' : 'Kopiera länk'}
                  </button>
                )}
                {!isMultiYear ? (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); onView(latest.id) }}
                      className="text-xs text-white/40 hover:text-white transition-colors"
                    >
                      Visa →
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onConfirm({
                          action: 'archive', scope: 'survey', surveyId: latest.id,
                          expectedName: latest.brf_name ?? `Enkät ${latest.survey_year}`,
                          label: `Arkivera ${latest.brf_name ?? `Enkät ${latest.survey_year}`}`,
                          paidCount: countPaid([latest.id]),
                        })
                      }}
                      className="text-xs text-orange-400/70 hover:text-orange-300 transition-colors"
                    >
                      Arkivera
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        const ids = group.surveys.filter(s => !s.deleted_at).map(s => s.id)
                        onConfirm({
                          action: 'archive', scope: 'brf', brfBaseName: group.name,
                          expectedName: group.name,
                          label: `Arkivera hela ${group.name} (${ids.length} enkäter)`,
                          paidCount: countPaid(ids),
                        })
                      }}
                      className="text-xs text-orange-400/70 hover:text-orange-300 transition-colors"
                    >
                      Arkivera BRF
                    </button>
                    <svg className={`w-4 h-4 text-white/40 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </>
                )}
              </div>
            </div>

            {/* Expanderade år */}
            {isMultiYear && isExpanded && (
              <div className="border-t border-white/10">
                {group.surveys.map(survey => {
                  const kpis = survey.kpi_results ?? []
                  return (
                    <div key={survey.id} className="px-5 py-3 flex items-center justify-between border-b border-white/5 last:border-b-0 hover:bg-white/[0.03] transition-colors">
                      <div className="flex items-center gap-3 pl-14">
                        <span className="text-sm font-medium text-white/70">{survey.survey_year}</span>
                        <span className="text-xs text-white/30">{new Date(survey.created_at).toLocaleDateString('sv-SE')}</span>
                        <span className={`text-xs ${survey.status === 'completed' ? 'text-green-400/70' : 'text-yellow-400/70'}`}>
                          {survey.status === 'completed' ? 'Genomförd' : 'Väntar'}
                        </span>
                      </div>
                      <div className="flex items-center gap-6">
                        {kpis.length > 0 && (
                          <div className="flex items-center gap-1.5">
                            {[...Array(7)].map((_, i) => {
                              const kpi = kpis.find(k => k.kpi_number === i + 1)
                              return <div key={i} className={`w-2 h-2 rounded-full ${kpi ? lightDot(kpi.traffic_light) : 'bg-white/10'}`} />
                            })}
                          </div>
                        )}
                        {survey.token && (
                          <button
                            onClick={() => onCopyLink(survey.id, survey.token)}
                            className={`text-xs transition-colors ${copiedId === survey.id ? 'text-green-400' : 'text-white/40 hover:text-white'}`}
                          >
                            {copiedId === survey.id ? '✓ Kopierad' : 'Kopiera länk'}
                          </button>
                        )}
                        <button
                          onClick={() => onView(survey.id)}
                          className="text-xs text-white/40 hover:text-white transition-colors"
                        >
                          Visa →
                        </button>
                        <button
                          onClick={() =>
                            onConfirm({
                              action: 'archive', scope: 'survey', surveyId: survey.id,
                              expectedName: survey.brf_name ?? `Enkät ${survey.survey_year}`,
                              label: `Arkivera ${survey.brf_name ?? `Enkät ${survey.survey_year}`}`,
                              paidCount: countPaid([survey.id]),
                            })
                          }
                          className="text-xs text-orange-400/70 hover:text-orange-300 transition-colors"
                        >
                          Arkivera
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
