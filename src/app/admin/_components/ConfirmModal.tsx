import { type ConfirmState } from '../_helpers'

// Bekräftelsemodal (arkivera/återställ/radera permanent). Rent
// presentationslager; page.tsx guardar med {confirmState && ...} och
// äger all state/logik. confirmState är garanterat icke-null här.
export function ConfirmModal({
  confirmState,
  confirmInput,
  processing,
  actionMsg,
  onConfirmInput,
  onExecute,
  onCancel,
}: {
  confirmState: NonNullable<ConfirmState>
  confirmInput: string
  processing: boolean
  actionMsg: string
  onConfirmInput: (v: string) => void
  onExecute: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#0f1729] border border-white/15 rounded-2xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold mb-1">
          {confirmState.action === 'archive' && 'Arkivera enkät'}
          {confirmState.action === 'restore' && 'Återställ enkät'}
          {confirmState.action === 'hard_delete' && 'Radera permanent'}
        </h3>
        <p className="text-white/50 text-sm mb-4">{confirmState.label}</p>

        {confirmState.action === 'archive' && (
          <p className="text-white/60 text-sm mb-4">
            Enkäten döljs för BRF:er och i listan men kan återställas från
            &quot;Arkiverade enkäter&quot;. Ingen data raderas.
          </p>
        )}
        {confirmState.action === 'hard_delete' && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
            <p className="text-red-300 text-sm font-medium">Detta går INTE att ångra.</p>
            <p className="text-red-300/80 text-xs mt-1">
              Enkät, svar, nyckeltal, AI-analys{confirmState.paidCount > 0 ? ' OCH betalningsposter' : ''} raderas permanent.
            </p>
          </div>
        )}
        {confirmState.paidCount > 0 && confirmState.action !== 'restore' && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-4">
            <p className="text-amber-300 text-sm font-medium">
              ⚠️ {confirmState.paidCount} betald{confirmState.paidCount > 1 ? 'a' : ''} rapport{confirmState.paidCount > 1 ? 'er' : ''} berörs
            </p>
            <p className="text-amber-300/80 text-xs mt-1">
              En kund har betalat för {confirmState.paidCount > 1 ? 'dessa rapporter' : 'denna rapport'}. Bokföringsdata påverkas.
            </p>
          </div>
        )}

        {confirmState.action !== 'restore' && (
          <div className="mb-4">
            <label className="text-white/50 text-xs block mb-1.5">
              Skriv <span className="text-white font-medium">{confirmState.expectedName}</span> för att bekräfta
            </label>
            <input
              type="text"
              value={confirmInput}
              onChange={e => onConfirmInput(e.target.value)}
              autoFocus
              className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-400"
              placeholder={confirmState.expectedName}
            />
          </div>
        )}

        {actionMsg && (
          <p className={`text-sm mb-4 ${actionMsg.startsWith('Fel') ? 'text-red-400' : 'text-amber-300'}`}>
            {actionMsg}
          </p>
        )}

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={processing}
            className="text-white/50 hover:text-white text-sm px-4 py-2 transition-colors disabled:opacity-50"
          >
            Avbryt
          </button>
          <button
            onClick={onExecute}
            disabled={
              processing ||
              (confirmState.action !== 'restore' &&
                confirmInput.trim().toLowerCase() !== confirmState.expectedName.toLowerCase())
            }
            className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-40 ${
              confirmState.action === 'hard_delete'
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : confirmState.action === 'restore'
                  ? 'bg-green-600 hover:bg-green-500 text-white'
                  : 'bg-orange-600 hover:bg-orange-500 text-white'
            }`}
          >
            {processing ? 'Arbetar...' :
              confirmState.action === 'archive' ? 'Arkivera' :
              confirmState.action === 'restore' ? 'Återställ' : 'Radera permanent'}
          </button>
        </div>
      </div>
    </div>
  )
}
