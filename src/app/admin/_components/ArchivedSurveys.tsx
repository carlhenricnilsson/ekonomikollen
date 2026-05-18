import { type Survey, type ConfirmState } from '../_helpers'

// Arkiverade enkäter (utfällbar sektion). Rent presentationslager;
// page.tsx guardar med {archivedSurveys.length > 0 && ...} och äger state.
export function ArchivedSurveys({
  archivedSurveys,
  showArchived,
  paidSurveyIds,
  countPaid,
  onToggleArchived,
  onConfirm,
}: {
  archivedSurveys: Survey[]
  showArchived: boolean
  paidSurveyIds: string[]
  countPaid: (surveyIds: string[]) => number
  onToggleArchived: () => void
  onConfirm: (cs: NonNullable<ConfirmState>) => void
}) {
  return (
    <div className="mt-10">
      <button
        onClick={onToggleArchived}
        className="flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition-colors mb-4"
      >
        <svg className={`w-4 h-4 transition-transform ${showArchived ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
        Arkiverade enkäter ({archivedSurveys.length})
      </button>
      {showArchived && (
        <div className="space-y-2">
          {archivedSurveys.map(survey => {
            const isPaid = paidSurveyIds.includes(survey.id)
            const name = survey.brf_name ?? `Enkät ${survey.survey_year}`
            return (
              <div key={survey.id} className="bg-white/[0.03] border border-white/10 rounded-xl px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-white/60">{name}</span>
                  <span className="text-xs text-white/30">
                    arkiverad {survey.deleted_at ? new Date(survey.deleted_at).toLocaleDateString('sv-SE') : ''}
                  </span>
                  {isPaid && (
                    <span className="text-xs bg-amber-500/15 text-amber-300 px-1.5 py-0.5 rounded-full">betald rapport</span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() =>
                      onConfirm({
                        action: 'restore', scope: 'survey', surveyId: survey.id,
                        expectedName: name, label: `Återställ ${name}`,
                        paidCount: 0,
                      })
                    }
                    className="text-xs text-green-400/80 hover:text-green-300 transition-colors"
                  >
                    Återställ
                  </button>
                  <button
                    onClick={() =>
                      onConfirm({
                        action: 'hard_delete', scope: 'survey', surveyId: survey.id,
                        expectedName: name, label: `Radera ${name} PERMANENT`,
                        paidCount: countPaid([survey.id]),
                      })
                    }
                    className="text-xs text-red-400/80 hover:text-red-300 transition-colors"
                  >
                    Radera permanent
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
