// "Skapa enkätlänk"-modal. Rent presentationslager – page.tsx guardar
// med {showCreateLink && ...} och äger all state/logik.
export function CreateLinkModal({
  createdLink,
  newBrfName,
  creating,
  onNewBrfName,
  onGenerate,
  onCancel,
  onCloseReset,
}: {
  createdLink: string
  newBrfName: string
  creating: boolean
  onNewBrfName: (v: string) => void
  onGenerate: () => void
  onCancel: () => void
  onCloseReset: () => void
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8">
      <h2 className="font-bold text-lg mb-4">Skapa ny enkätlänk</h2>
      {!createdLink ? (
        <>
          <label className="block text-sm text-white/60 mb-2">BRF-namn (valfritt)</label>
          <input
            type="text"
            value={newBrfName}
            onChange={e => onNewBrfName(e.target.value)}
            placeholder="T.ex. BRF Solgläntan"
            className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-3 text-white mb-4 focus:outline-none focus:border-blue-400"
          />
          <div className="flex gap-3">
            <button
              onClick={onGenerate}
              disabled={creating}
              className="bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white font-medium px-6 py-2.5 rounded-xl text-sm transition-colors"
            >
              {creating ? 'Skapar...' : 'Generera länk'}
            </button>
            <button
              onClick={onCancel}
              className="text-white/40 hover:text-white text-sm px-4 py-2.5 transition-colors"
            >
              Avbryt
            </button>
          </div>
        </>
      ) : (
        <div>
          <p className="text-green-400 text-sm font-medium mb-3">✅ Länk skapad! Skicka denna till BRF:en:</p>
          <div className="bg-black/30 border border-white/10 rounded-xl p-4 flex items-center justify-between gap-4 mb-4">
            <span className="text-blue-300 text-sm break-all">{createdLink}</span>
            <button
              onClick={() => {
                const el = document.createElement('textarea')
                el.value = createdLink
                document.body.appendChild(el)
                el.select()
                document.execCommand('copy')
                document.body.removeChild(el)
                alert('Länk kopierad!')
              }}
              className="shrink-0 bg-white/10 hover:bg-white/20 text-white text-xs px-3 py-2 rounded-lg transition-colors"
            >
              Kopiera
            </button>
          </div>
          <button
            onClick={onCloseReset}
            className="text-white/40 hover:text-white text-sm transition-colors"
          >
            Stäng
          </button>
        </div>
      )}
    </div>
  )
}
