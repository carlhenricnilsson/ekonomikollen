// Sökfält (BRF-namn + år). Rent presentationslager – state ägs av page.tsx.
export function SearchBar({
  searchQuery,
  searchYear,
  availableYears,
  onSearchQuery,
  onSearchYear,
  onClear,
}: {
  searchQuery: string
  searchYear: string
  availableYears: number[]
  onSearchQuery: (v: string) => void
  onSearchYear: (v: string) => void
  onClear: () => void
}) {
  return (
    <div className="flex gap-3 mb-6">
      <div className="relative flex-1">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={searchQuery}
          onChange={e => onSearchQuery(e.target.value)}
          placeholder="Sök på BRF-namn..."
          className="w-full bg-white/5 border border-white/20 rounded-xl pl-9 pr-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-400 placeholder-white/30"
        />
      </div>
      <select
        value={searchYear}
        onChange={e => onSearchYear(e.target.value)}
        className="bg-white/5 border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-400"
      >
        <option value="">Alla år</option>
        {availableYears.map(y => (
          <option key={y} value={String(y)}>{y}</option>
        ))}
      </select>
      {(searchQuery || searchYear) && (
        <button
          onClick={onClear}
          className="text-white/40 hover:text-white text-sm px-3 transition-colors"
        >
          Rensa
        </button>
      )}
    </div>
  )
}
