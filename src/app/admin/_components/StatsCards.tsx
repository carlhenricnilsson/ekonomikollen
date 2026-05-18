import { type Survey } from '../_helpers'

// Statistik-kort (rent presentationslager – utbrutet ur page.tsx, oförändrat)
export function StatsCards({ surveys }: { surveys: Survey[] }) {
  return (
    <div className="grid grid-cols-3 gap-4 mb-10">
      <div className="bg-white/5 border border-white/10 rounded-xl p-5">
        <p className="text-3xl font-bold">{surveys.length}</p>
        <p className="text-white/40 text-sm mt-1">Totalt antal enkäter</p>
      </div>
      <div className="bg-white/5 border border-white/10 rounded-xl p-5">
        <p className="text-3xl font-bold text-green-400">
          {surveys.filter(s => s.status === 'completed').length}
        </p>
        <p className="text-white/40 text-sm mt-1">Genomförda</p>
      </div>
      <div className="bg-white/5 border border-white/10 rounded-xl p-5">
        <p className="text-3xl font-bold text-blue-400">
          {new Set(surveys.map(s => (s.brf_name ?? '').replace(/\s+\d{4}$/, '').trim())).size}
        </p>
        <p className="text-white/40 text-sm mt-1">Unika BRF:er</p>
      </div>
    </div>
  )
}
