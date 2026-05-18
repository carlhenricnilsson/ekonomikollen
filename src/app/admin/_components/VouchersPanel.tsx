type Voucher = {
  id: string
  code: string
  discount_percent: number
  max_uses: number
  times_used: number
  valid_until: string | null
}

// Voucher-/rabattkodspanel. Rent presentationslager; page.tsx guardar
// med {showVouchers && ...} och äger all state/logik.
export function VouchersPanel({
  vouchers,
  newVoucherCode,
  newVoucherDiscount,
  newVoucherMaxUses,
  creatingVoucher,
  voucherMsg,
  onNewVoucherCode,
  onNewVoucherDiscount,
  onNewVoucherMaxUses,
  onCreate,
  onClose,
}: {
  vouchers: Voucher[]
  newVoucherCode: string
  newVoucherDiscount: number
  newVoucherMaxUses: number
  creatingVoucher: boolean
  voucherMsg: string
  onNewVoucherCode: (v: string) => void
  onNewVoucherDiscount: (v: number) => void
  onNewVoucherMaxUses: (v: number) => void
  onCreate: () => void
  onClose: () => void
}) {
  return (
    <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-6 mb-8">
      <h2 className="font-bold text-lg mb-4">Vouchers / Rabattkoder</h2>
      <p className="text-white/50 text-sm mb-4">
        Skapa rabattkoder som BRF-admins kan använda för att låsa upp rapporter. Normalpris: 5 995 kr.
      </p>

      {/* Skapa ny */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4">
        <h3 className="text-sm font-medium mb-3">Skapa ny voucher</h3>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div>
            <label className="block text-xs text-white/50 mb-1">Kod</label>
            <input
              type="text"
              value={newVoucherCode}
              onChange={e => onNewVoucherCode(e.target.value.toUpperCase())}
              placeholder="GRATIS2025"
              className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-400 font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">Rabatt (%)</label>
            <input
              type="number"
              value={newVoucherDiscount}
              onChange={e => onNewVoucherDiscount(Number(e.target.value))}
              min={0}
              max={100}
              className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-400"
            />
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1">Max användningar</label>
            <input
              type="number"
              value={newVoucherMaxUses}
              onChange={e => onNewVoucherMaxUses(Number(e.target.value))}
              min={1}
              className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-400"
            />
          </div>
        </div>
        {voucherMsg && <p className={`text-sm mb-3 ${voucherMsg.includes('skapad') ? 'text-green-400' : 'text-red-400'}`}>{voucherMsg}</p>}
        <button
          onClick={onCreate}
          disabled={!newVoucherCode || creatingVoucher}
          className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-medium px-5 py-2 rounded-xl text-sm transition-colors"
        >
          {creatingVoucher ? 'Skapar...' : 'Skapa voucher'}
        </button>
      </div>

      {/* Lista befintliga */}
      {vouchers.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-white/60">Befintliga vouchers</h3>
          {vouchers.map(v => (
            <div key={v.id} className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="font-mono text-amber-400 font-medium text-sm">{v.code}</span>
                <span className="text-white/50 text-xs">
                  {v.discount_percent === 100 ? 'Helt gratis' : `${v.discount_percent}% rabatt`}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-white/40">
                <span>Använd: {v.times_used}/{v.max_uses}</span>
                {v.valid_until && <span>Giltig t.o.m. {new Date(v.valid_until).toLocaleDateString('sv-SE')}</span>}
                <span className={v.times_used >= v.max_uses ? 'text-red-400' : 'text-green-400'}>
                  {v.times_used >= v.max_uses ? 'Förbrukad' : 'Aktiv'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <button onClick={onClose} className="text-white/40 hover:text-white text-sm mt-4 transition-colors">
        Stäng
      </button>
    </div>
  )
}
