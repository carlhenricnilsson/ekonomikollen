// Titelrad + åtgärdsknappar (rent presentationslager – callbacks ägs av page.tsx)
export function PageHeader({
  surveysCount,
  onUploadPdf,
  onCreateLink,
  onToggleInvite,
  onToggleVouchers,
}: {
  surveysCount: number
  onUploadPdf: () => void
  onCreateLink: () => void
  onToggleInvite: () => void
  onToggleVouchers: () => void
}) {
  return (
    <div className="flex items-center justify-between mb-8">
      <div>
        <h1 className="text-2xl font-bold">Alla enkäter</h1>
        <p className="text-white/40 text-sm mt-1">{surveysCount} enkäter totalt</p>
      </div>
      <div className="flex gap-3 flex-wrap">
        <button
          onClick={onUploadPdf}
          className="bg-purple-500 hover:bg-purple-400 text-white font-medium px-5 py-2.5 rounded-xl text-sm transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
          Ladda upp årsredovisning
        </button>
        <button
          onClick={onCreateLink}
          className="bg-blue-500 hover:bg-blue-400 text-white font-medium px-5 py-2.5 rounded-xl text-sm transition-colors"
        >
          + Skapa enkätlänk
        </button>
        <button
          onClick={onToggleInvite}
          className="bg-green-600 hover:bg-green-500 text-white font-medium px-5 py-2.5 rounded-xl text-sm transition-colors"
        >
          Bjud in BRF-admin
        </button>
        <button
          onClick={onToggleVouchers}
          className="bg-amber-600 hover:bg-amber-500 text-white font-medium px-5 py-2.5 rounded-xl text-sm transition-colors"
        >
          Vouchers
        </button>
      </div>
    </div>
  )
}
