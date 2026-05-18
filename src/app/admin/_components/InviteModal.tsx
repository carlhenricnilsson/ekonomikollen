// "Bjud in BRF-admin"-panel. Rent presentationslager; page.tsx guardar
// med {showInvite && ...} och äger all state/logik.
export function InviteModal({
  inviteEmail,
  inviteBrf,
  inviting,
  inviteMsg,
  onInviteEmail,
  onInviteBrf,
  onSend,
  onClose,
}: {
  inviteEmail: string
  inviteBrf: string
  inviting: boolean
  inviteMsg: string
  onInviteEmail: (v: string) => void
  onInviteBrf: (v: string) => void
  onSend: () => void
  onClose: () => void
}) {
  return (
    <div className="bg-green-500/5 border border-green-500/20 rounded-2xl p-6 mb-8">
      <h2 className="font-bold text-lg mb-4">Bjud in BRF-admin</h2>
      <p className="text-white/50 text-sm mb-4">
        Skicka en inbjudan till en BRF-styrelsemedlem. Om de redan har ett konto kopplas BRF:en automatiskt.
      </p>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm text-white/60 mb-1">E-post</label>
          <input
            type="email"
            value={inviteEmail}
            onChange={e => onInviteEmail(e.target.value)}
            placeholder="styrelse@brf.se"
            className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-400"
          />
        </div>
        <div>
          <label className="block text-sm text-white/60 mb-1">BRF-namn (valfritt)</label>
          <input
            type="text"
            value={inviteBrf}
            onChange={e => onInviteBrf(e.target.value)}
            placeholder="BRF Solgläntan"
            className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-400"
          />
        </div>
      </div>
      {inviteMsg && <p className={`text-sm mb-3 ${inviteMsg.includes('skickad') ? 'text-green-400' : 'text-red-400'}`}>{inviteMsg}</p>}
      <div className="flex gap-3">
        <button
          onClick={onSend}
          disabled={!inviteEmail || inviting}
          className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-medium px-6 py-2.5 rounded-xl text-sm transition-colors"
        >
          {inviting ? 'Skickar...' : 'Skicka inbjudan'}
        </button>
        <button onClick={onClose} className="text-white/40 hover:text-white text-sm px-4 py-2.5 transition-colors">
          Stäng
        </button>
      </div>
    </div>
  )
}
