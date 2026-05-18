// Sidhuvud med e-post + logga ut (rent presentationslager, oförändrat)
export function HeaderBar({ userEmail, onLogout }: { userEmail: string; onLogout: () => void }) {
  return (
    <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-xl font-bold">BRF-Ekonomi<span className="text-blue-400">kollen</span></span>
        <span className="bg-purple-500/20 text-purple-300 text-xs font-medium px-2 py-0.5 rounded-full">Superadmin</span>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-white/40 text-sm">{userEmail}</span>
        <button onClick={onLogout} className="text-sm text-white/50 hover:text-white transition-colors">
          Logga ut
        </button>
      </div>
    </div>
  )
}
