import { confColor, confLabel } from '../_helpers'

// PDF-uppladdning + granskning av extraherade värden. Rent presentationslager;
// page.tsx guardar med {showPdfUpload && ...} och äger all state/logik.
export function PdfUploadModal({
  pdfFile,
  pdfExtracting,
  pdfExtracted,
  pdfConfidence,
  pdfNotes,
  pdfError,
  pdfSubmitting,
  onPdfFile,
  onExtract,
  onSubmit,
  onCancel,
  onReanalyze,
  onAbortFromReview,
}: {
  pdfFile: File | null
  pdfExtracting: boolean
  pdfExtracted: Record<string, unknown> | null
  pdfConfidence: Record<string, string> | null
  pdfNotes: string
  pdfError: string
  pdfSubmitting: boolean
  onPdfFile: (f: File | null) => void
  onExtract: () => void
  onSubmit: () => void
  onCancel: () => void
  onReanalyze: () => void
  onAbortFromReview: () => void
}) {
  return (
    <div className="bg-purple-500/5 border border-purple-500/20 rounded-2xl p-6 mb-8">
      <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
        Ladda upp årsredovisning (PDF)
      </h2>

      {!pdfExtracted ? (
        <>
          <p className="text-white/50 text-sm mb-4">
            Ladda upp en BRFs årsredovisning i PDF-format. AI:n extraherar automatiskt alla ekonomiska nyckeltal.
          </p>
          <input
            type="file"
            accept=".pdf"
            onChange={e => onPdfFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-white/60 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-purple-500/20 file:text-purple-300 hover:file:bg-purple-500/30 mb-4"
          />
          {pdfFile && (
            <p className="text-white/40 text-xs mb-4">
              Vald fil: {pdfFile.name} ({(pdfFile.size / 1024 / 1024).toFixed(1)} MB)
            </p>
          )}
          {pdfError && <p className="text-red-400 text-sm mb-4">{pdfError}</p>}
          <div className="flex gap-3">
            <button
              onClick={onExtract}
              disabled={!pdfFile || pdfExtracting}
              className="bg-purple-500 hover:bg-purple-400 disabled:opacity-50 text-white font-medium px-6 py-2.5 rounded-xl text-sm transition-colors flex items-center gap-2"
            >
              {pdfExtracting ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  Extraherar... (30–60 sek)
                </>
              ) : 'Analysera PDF'}
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
        <>
          {/* Extraherade värden – granska och skicka in */}
          <p className="text-green-400 text-sm font-medium mb-1">
            ✅ Värden extraherade från: {pdfFile?.name}
          </p>
          {pdfExtracted.brf_name && (
            <p className="text-white/60 text-sm mb-3">BRF: <span className="text-white font-medium">{pdfExtracted.brf_name as string}</span></p>
          )}
          {pdfNotes && (
            <p className="text-white/40 text-xs mb-4 italic">{pdfNotes}</p>
          )}

          <div className="grid grid-cols-2 gap-2 mb-4 max-h-[400px] overflow-y-auto pr-2">
            {Object.entries(pdfExtracted).filter(([k]) => k !== 'brf_name').map(([key, val]) => (
              <div key={key} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-white/40 text-[10px] font-mono truncate">{key}</p>
                  <p className="text-white text-sm font-medium">
                    {val === null ? <span className="text-white/20">—</span> :
                     typeof val === 'boolean' ? (val ? 'Ja' : 'Nej') :
                     typeof val === 'number' ? val.toLocaleString('sv-SE') :
                     String(val)}
                  </p>
                </div>
                {pdfConfidence?.[key] && (
                  <span className={`text-[10px] font-medium shrink-0 ml-2 ${confColor(pdfConfidence[key])}`}>
                    {confLabel(pdfConfidence[key])}
                  </span>
                )}
              </div>
            ))}
          </div>

          {pdfError && <p className="text-red-400 text-sm mb-4">{pdfError}</p>}
          <div className="flex gap-3">
            <button
              onClick={onSubmit}
              disabled={pdfSubmitting}
              className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-medium px-6 py-2.5 rounded-xl text-sm transition-colors flex items-center gap-2"
            >
              {pdfSubmitting ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  Sparar...
                </>
              ) : 'Godkänn och beräkna KPI:er →'}
            </button>
            <button
              onClick={onReanalyze}
              className="text-white/40 hover:text-white text-sm px-4 py-2.5 transition-colors"
            >
              Analysera igen
            </button>
            <button
              onClick={onAbortFromReview}
              className="text-white/40 hover:text-white text-sm px-4 py-2.5 transition-colors"
            >
              Avbryt
            </button>
          </div>
        </>
      )}
    </div>
  )
}
