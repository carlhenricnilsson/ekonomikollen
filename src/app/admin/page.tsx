'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase-client'

type Survey = {
  id: string
  survey_year: number
  status: string
  brf_name: string | null
  token: string
  version: number | null
  created_at: string
  kpi_results: { kpi_number: number; value: number; traffic_light: string }[]
}

export default function AdminPage() {
  const router = useRouter()
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [loading, setLoading] = useState(true)
  const [userEmail, setUserEmail] = useState('')
  const [showCreateLink, setShowCreateLink] = useState(false)
  const [newBrfName, setNewBrfName] = useState('')
  const [createdLink, setCreatedLink] = useState('')
  const [creating, setCreating] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchYear, setSearchYear] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  // PDF-uppladdning
  const [showPdfUpload, setShowPdfUpload] = useState(false)
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [pdfExtracting, setPdfExtracting] = useState(false)
  const [pdfExtracted, setPdfExtracted] = useState<Record<string, unknown> | null>(null)
  const [pdfConfidence, setPdfConfidence] = useState<Record<string, string> | null>(null)
  const [pdfNotes, setPdfNotes] = useState('')
  const [pdfError, setPdfError] = useState('')
  const [pdfSubmitting, setPdfSubmitting] = useState(false)
  // Inbjudningar
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteBrf, setInviteBrf] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState('')
  // Vouchers
  const [showVouchers, setShowVouchers] = useState(false)
  const [vouchers, setVouchers] = useState<{ id: string; code: string; discount_percent: number; max_uses: number; times_used: number; valid_until: string | null }[]>([])
  const [newVoucherCode, setNewVoucherCode] = useState('')
  const [newVoucherDiscount, setNewVoucherDiscount] = useState(100)
  const [newVoucherMaxUses, setNewVoucherMaxUses] = useState(1)
  const [creatingVoucher, setCreatingVoucher] = useState(false)
  const [voucherMsg, setVoucherMsg] = useState('')
  const [userId, setUserId] = useState('')

  useEffect(() => {
    checkAuth()
    fetchSurveys()
  }, [])

  async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setUserEmail(user.email ?? '')
    setUserId(user.id)

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'superadmin') router.push('/dashboard')
  }

  async function fetchSurveys() {
    const { data } = await supabase
      .from('surveys')
      .select('*, kpi_results(*)')

    // Sortera alfabetiskt på BRF-namn, sedan år fallback
    const sorted = (data ?? []).sort((a, b) => {
      const nameA = (a.brf_name ?? `Enkät ${a.survey_year}`).toLowerCase()
      const nameB = (b.brf_name ?? `Enkät ${b.survey_year}`).toLowerCase()
      if (nameA < nameB) return -1
      if (nameA > nameB) return 1
      return (a.survey_year ?? 0) - (b.survey_year ?? 0)
    })

    setSurveys(sorted)
    setLoading(false)
  }

  async function createSurveyLink() {
    setCreating(true)
    // Skicka bara brf_name – API:et normaliserar namn och extraherar år
    const res = await fetch('/api/create-survey-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brf_name: newBrfName }),
    })
    const data = await res.json()
    if (data.token) {
      const baseUrl = window.location.origin
      setCreatedLink(`${baseUrl}/survey?token=${data.token}`)
      fetchSurveys()
    }
    setCreating(false)
  }

  async function sendInvite() {
    setInviting(true)
    setInviteMsg('')
    const res = await fetch('/api/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail, brf_base_name: inviteBrf || null, invited_by: userId }),
    })
    const data = await res.json()
    if (data.success) {
      setInviteMsg(`Inbjudan skickad till ${inviteEmail}`)
      setInviteEmail('')
      setInviteBrf('')
    } else {
      setInviteMsg(data.error || 'Något gick fel')
    }
    setInviting(false)
  }

  async function fetchVouchers() {
    const res = await fetch('/api/vouchers')
    const data = await res.json()
    setVouchers(data.vouchers ?? [])
  }

  async function createVoucher() {
    setCreatingVoucher(true)
    setVoucherMsg('')
    const res = await fetch('/api/vouchers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: newVoucherCode,
        discount_percent: newVoucherDiscount,
        max_uses: newVoucherMaxUses,
        created_by: userId,
      }),
    })
    const data = await res.json()
    if (data.voucher) {
      setVoucherMsg(`Voucher "${data.voucher.code}" skapad`)
      setNewVoucherCode('')
      fetchVouchers()
    } else {
      setVoucherMsg(data.error || 'Något gick fel')
    }
    setCreatingVoucher(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function extractPdf() {
    if (!pdfFile) return
    setPdfExtracting(true)
    setPdfError('')
    setPdfExtracted(null)
    try {
      const form = new FormData()
      form.append('pdf', pdfFile)
      const res = await fetch('/api/extract-pdf', { method: 'POST', body: form })
      const data = await res.json()
      if (data.error) {
        setPdfError(data.error)
      } else {
        setPdfExtracted(data.extracted)
        setPdfConfidence(data.confidence)
        setPdfNotes(data.notes || '')
      }
    } catch {
      setPdfError('Kunde inte bearbeta PDF-filen')
    } finally {
      setPdfExtracting(false)
    }
  }

  async function submitExtracted() {
    if (!pdfExtracted) return
    setPdfSubmitting(true)
    try {
      // Skapa enkätlänk först
      const linkRes = await fetch('/api/create-survey-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brf_name: pdfExtracted.brf_name as string }),
      })
      const linkData = await linkRes.json()
      if (!linkData.token) { setPdfError('Kunde inte skapa enkät'); return }

      // Skicka in extraherade svar via survey-API (med token)
      const answers: Record<string, unknown> = { ...pdfExtracted }
      delete answers.brf_name
      const surveyRes = await fetch('/api/survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers, token: linkData.token }),
      })
      const surveyData = await surveyRes.json()
      if (surveyData.surveyId) {
        // Stäng och navigera till resultatsidan
        setShowPdfUpload(false)
        setPdfFile(null)
        setPdfExtracted(null)
        setPdfConfidence(null)
        setPdfNotes('')
        fetchSurveys()
        router.push(`/results/${surveyData.surveyId}`)
      } else {
        setPdfError('Kunde inte spara enkäten')
      }
    } catch {
      setPdfError('Något gick fel vid inskickning')
    } finally {
      setPdfSubmitting(false)
    }
  }

  // Konfidensindikator-färg
  function confColor(level: string) {
    if (level === 'high') return 'text-green-400'
    if (level === 'medium') return 'text-yellow-400'
    return 'text-red-400'
  }

  function confLabel(level: string) {
    if (level === 'high') return 'Säker'
    if (level === 'medium') return 'Osäker'
    return 'Gissning'
  }

  const filteredSurveys = surveys.filter(s => {
    const nameMatch = searchQuery === '' || (s.brf_name ?? '').toLowerCase().includes(searchQuery.toLowerCase())
    const yearMatch = searchYear === '' || String(s.survey_year) === searchYear
    return nameMatch && yearMatch
  })

  const availableYears = [...new Set(surveys.map(s => s.survey_year))].sort((a, b) => b - a)

  // Gruppera undersökningar per BRF-namn
  type BrfGroup = { name: string; surveys: Survey[] }
  const grouped: BrfGroup[] = (() => {
    const map = new Map<string, Survey[]>()
    for (const s of filteredSurveys) {
      // Extrahera basnamn utan år (t.ex. "BRF Solgläntan")
      const fullName = s.brf_name ?? `Enkät`
      const baseName = fullName.replace(/\s+\d{4}$/, '').trim() || fullName
      if (!map.has(baseName)) map.set(baseName, [])
      map.get(baseName)!.push(s)
    }
    // Sortera varje grupp efter år (nyaste först)
    const groups: BrfGroup[] = []
    for (const [name, surveys] of map) {
      surveys.sort((a, b) => b.survey_year - a.survey_year)
      groups.push({ name, surveys })
    }
    groups.sort((a, b) => a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1)
    return groups
  })()

  const [expandedBrf, setExpandedBrf] = useState<Set<string>>(new Set())

  function copyLink(surveyId: string, token: string) {
    const link = `${window.location.origin}/survey?token=${token}`
    try {
      navigator.clipboard.writeText(link)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = link
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopiedId(surveyId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const lightDot = (light: string) => {
    if (light === 'red') return 'bg-red-400'
    if (light === 'yellow') return 'bg-yellow-400'
    if (light === 'green') return 'bg-green-400'
    return 'bg-blue-400'
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold">BRF-Ekonomi<span className="text-blue-400">kollen</span></span>
          <span className="bg-purple-500/20 text-purple-300 text-xs font-medium px-2 py-0.5 rounded-full">Superadmin</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-white/40 text-sm">{userEmail}</span>
          <button onClick={handleLogout} className="text-sm text-white/50 hover:text-white transition-colors">
            Logga ut
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Alla enkäter</h1>
            <p className="text-white/40 text-sm mt-1">{surveys.length} enkäter totalt</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => { setShowPdfUpload(true); setPdfFile(null); setPdfExtracted(null); setPdfError('') }}
              className="bg-purple-500 hover:bg-purple-400 text-white font-medium px-5 py-2.5 rounded-xl text-sm transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
              Ladda upp årsredovisning
            </button>
            <button
              onClick={() => { setShowCreateLink(true); setCreatedLink('') }}
              className="bg-blue-500 hover:bg-blue-400 text-white font-medium px-5 py-2.5 rounded-xl text-sm transition-colors"
            >
              + Skapa enkätlänk
            </button>
            <button
              onClick={() => setShowInvite(!showInvite)}
              className="bg-green-600 hover:bg-green-500 text-white font-medium px-5 py-2.5 rounded-xl text-sm transition-colors"
            >
              Bjud in BRF-admin
            </button>
            <button
              onClick={() => { setShowVouchers(!showVouchers); if (!showVouchers) fetchVouchers() }}
              className="bg-amber-600 hover:bg-amber-500 text-white font-medium px-5 py-2.5 rounded-xl text-sm transition-colors"
            >
              Vouchers
            </button>
          </div>
        </div>

        {/* Skapa länk-modal */}
        {showCreateLink && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8">
            <h2 className="font-bold text-lg mb-4">Skapa ny enkätlänk</h2>
            {!createdLink ? (
              <>
                <label className="block text-sm text-white/60 mb-2">BRF-namn (valfritt)</label>
                <input
                  type="text"
                  value={newBrfName}
                  onChange={e => setNewBrfName(e.target.value)}
                  placeholder="T.ex. BRF Solgläntan"
                  className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-3 text-white mb-4 focus:outline-none focus:border-blue-400"
                />
                <div className="flex gap-3">
                  <button
                    onClick={createSurveyLink}
                    disabled={creating}
                    className="bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white font-medium px-6 py-2.5 rounded-xl text-sm transition-colors"
                  >
                    {creating ? 'Skapar...' : 'Generera länk'}
                  </button>
                  <button
                    onClick={() => setShowCreateLink(false)}
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
                  onClick={() => { setShowCreateLink(false); setCreatedLink(''); setNewBrfName('') }}
                  className="text-white/40 hover:text-white text-sm transition-colors"
                >
                  Stäng
                </button>
              </div>
            )}
          </div>
        )}

        {/* PDF-uppladdning */}
        {showPdfUpload && (
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
                  onChange={e => setPdfFile(e.target.files?.[0] || null)}
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
                    onClick={extractPdf}
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
                    onClick={() => setShowPdfUpload(false)}
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
                    onClick={submitExtracted}
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
                    onClick={() => { setPdfExtracted(null); setPdfConfidence(null); setPdfNotes('') }}
                    className="text-white/40 hover:text-white text-sm px-4 py-2.5 transition-colors"
                  >
                    Analysera igen
                  </button>
                  <button
                    onClick={() => { setShowPdfUpload(false); setPdfExtracted(null) }}
                    className="text-white/40 hover:text-white text-sm px-4 py-2.5 transition-colors"
                  >
                    Avbryt
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Bjud in BRF-admin */}
        {showInvite && (
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
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="styrelse@brf.se"
                  className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-400"
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-1">BRF-namn (valfritt)</label>
                <input
                  type="text"
                  value={inviteBrf}
                  onChange={e => setInviteBrf(e.target.value)}
                  placeholder="BRF Solgläntan"
                  className="w-full bg-white/5 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-400"
                />
              </div>
            </div>
            {inviteMsg && <p className={`text-sm mb-3 ${inviteMsg.includes('skickad') ? 'text-green-400' : 'text-red-400'}`}>{inviteMsg}</p>}
            <div className="flex gap-3">
              <button
                onClick={sendInvite}
                disabled={!inviteEmail || inviting}
                className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-medium px-6 py-2.5 rounded-xl text-sm transition-colors"
              >
                {inviting ? 'Skickar...' : 'Skicka inbjudan'}
              </button>
              <button onClick={() => setShowInvite(false)} className="text-white/40 hover:text-white text-sm px-4 py-2.5 transition-colors">
                Stäng
              </button>
            </div>
          </div>
        )}

        {/* Vouchers */}
        {showVouchers && (
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
                    onChange={e => setNewVoucherCode(e.target.value.toUpperCase())}
                    placeholder="GRATIS2025"
                    className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-400 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/50 mb-1">Rabatt (%)</label>
                  <input
                    type="number"
                    value={newVoucherDiscount}
                    onChange={e => setNewVoucherDiscount(Number(e.target.value))}
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
                    onChange={e => setNewVoucherMaxUses(Number(e.target.value))}
                    min={1}
                    className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>
              {voucherMsg && <p className={`text-sm mb-3 ${voucherMsg.includes('skapad') ? 'text-green-400' : 'text-red-400'}`}>{voucherMsg}</p>}
              <button
                onClick={createVoucher}
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

            <button onClick={() => setShowVouchers(false)} className="text-white/40 hover:text-white text-sm mt-4 transition-colors">
              Stäng
            </button>
          </div>
        )}

        {/* Statistik */}
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

        {/* Sökfält */}
        {surveys.length > 0 && (
          <div className="flex gap-3 mb-6">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Sök på BRF-namn..."
                className="w-full bg-white/5 border border-white/20 rounded-xl pl-9 pr-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-400 placeholder-white/30"
              />
            </div>
            <select
              value={searchYear}
              onChange={e => setSearchYear(e.target.value)}
              className="bg-white/5 border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-400"
            >
              <option value="">Alla år</option>
              {availableYears.map(y => (
                <option key={y} value={String(y)}>{y}</option>
              ))}
            </select>
            {(searchQuery || searchYear) && (
              <button
                onClick={() => { setSearchQuery(''); setSearchYear('') }}
                className="text-white/40 hover:text-white text-sm px-3 transition-colors"
              >
                Rensa
              </button>
            )}
          </div>
        )}

        {/* Enkätlista */}
        {loading ? (
          <div className="text-white/30 text-center py-20">Laddar...</div>
        ) : surveys.length === 0 ? (
          <div className="text-center py-20 text-white/30">
            <p className="text-lg mb-2">Inga enkäter ännu</p>
            <p className="text-sm">Enkäter visas här när BRF:er fyller i dem</p>
          </div>
        ) : grouped.length === 0 ? (
          <div className="text-center py-16 text-white/30">
            <p className="text-lg mb-2">Inga träffar</p>
            <p className="text-sm">Prova ett annat sökord eller år</p>
          </div>
        ) : (
          <div className="space-y-3">
            {grouped.map(group => {
              const isMultiYear = group.surveys.length > 1
              const isExpanded = expandedBrf.has(group.name)
              const latest = group.surveys[0]
              const latestKpis = latest.kpi_results ?? []

              return (
                <div key={group.name} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                  {/* Grupp-header */}
                  <div
                    className={`p-5 flex items-center justify-between ${isMultiYear ? 'cursor-pointer hover:bg-white/[0.03]' : ''} transition-colors`}
                    onClick={() => {
                      if (!isMultiYear) return
                      setExpandedBrf(prev => {
                        const next = new Set(prev)
                        next.has(group.name) ? next.delete(group.name) : next.add(group.name)
                        return next
                      })
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="bg-blue-500/20 rounded-lg w-10 h-10 flex items-center justify-center text-blue-400 font-bold text-sm">
                        {latest.survey_year}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{group.name}</p>
                          {isMultiYear && (
                            <span className="text-xs bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded-full font-medium">
                              {group.surveys.length} år
                            </span>
                          )}
                          {(latest.version ?? 1) > 1 && (
                            <span className="text-xs bg-white/10 text-white/50 px-1.5 py-0.5 rounded">ver.{latest.version}</span>
                          )}
                        </div>
                        <p className="text-white/30 text-xs mt-0.5">
                          {isMultiYear
                            ? `${group.surveys[group.surveys.length - 1].survey_year}–${latest.survey_year}`
                            : `${latest.survey_year}`
                          } · <span className={latest.status === 'completed' ? 'text-green-400' : 'text-yellow-400'}>{latest.status === 'completed' ? 'Genomförd' : 'Väntar'}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      {latestKpis.length > 0 && (
                        <div className="flex items-center gap-2">
                          {[...Array(7)].map((_, i) => {
                            const kpi = latestKpis.find(k => k.kpi_number === i + 1)
                            return <div key={i} className={`w-2.5 h-2.5 rounded-full ${kpi ? lightDot(kpi.traffic_light) : 'bg-white/10'}`} />
                          })}
                        </div>
                      )}
                      <div className="flex gap-2 text-xs">
                        {latestKpis.filter(k => k.traffic_light === 'green').length > 0 && <span className="text-green-400">{latestKpis.filter(k => k.traffic_light === 'green').length} bra</span>}
                        {latestKpis.filter(k => k.traffic_light === 'yellow').length > 0 && <span className="text-yellow-400">{latestKpis.filter(k => k.traffic_light === 'yellow').length} bevaka</span>}
                        {latestKpis.filter(k => k.traffic_light === 'red').length > 0 && <span className="text-red-400">{latestKpis.filter(k => k.traffic_light === 'red').length} varning</span>}
                      </div>
                      {!isMultiYear && latest.token && (
                        <button
                          onClick={(e) => { e.stopPropagation(); copyLink(latest.id, latest.token) }}
                          className={`text-xs transition-colors ${copiedId === latest.id ? 'text-green-400' : 'text-white/40 hover:text-white'}`}
                        >
                          {copiedId === latest.id ? '✓ Kopierad' : 'Kopiera länk'}
                        </button>
                      )}
                      {!isMultiYear ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); router.push(`/results/${latest.id}`) }}
                          className="text-xs text-white/40 hover:text-white transition-colors"
                        >
                          Visa →
                        </button>
                      ) : (
                        <svg className={`w-4 h-4 text-white/40 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </div>
                  </div>

                  {/* Expanderade år */}
                  {isMultiYear && isExpanded && (
                    <div className="border-t border-white/10">
                      {group.surveys.map(survey => {
                        const kpis = survey.kpi_results ?? []
                        return (
                          <div key={survey.id} className="px-5 py-3 flex items-center justify-between border-b border-white/5 last:border-b-0 hover:bg-white/[0.03] transition-colors">
                            <div className="flex items-center gap-3 pl-14">
                              <span className="text-sm font-medium text-white/70">{survey.survey_year}</span>
                              <span className="text-xs text-white/30">{new Date(survey.created_at).toLocaleDateString('sv-SE')}</span>
                              <span className={`text-xs ${survey.status === 'completed' ? 'text-green-400/70' : 'text-yellow-400/70'}`}>
                                {survey.status === 'completed' ? 'Genomförd' : 'Väntar'}
                              </span>
                            </div>
                            <div className="flex items-center gap-6">
                              {kpis.length > 0 && (
                                <div className="flex items-center gap-1.5">
                                  {[...Array(7)].map((_, i) => {
                                    const kpi = kpis.find(k => k.kpi_number === i + 1)
                                    return <div key={i} className={`w-2 h-2 rounded-full ${kpi ? lightDot(kpi.traffic_light) : 'bg-white/10'}`} />
                                  })}
                                </div>
                              )}
                              {survey.token && (
                                <button
                                  onClick={() => copyLink(survey.id, survey.token)}
                                  className={`text-xs transition-colors ${copiedId === survey.id ? 'text-green-400' : 'text-white/40 hover:text-white'}`}
                                >
                                  {copiedId === survey.id ? '✓ Kopierad' : 'Kopiera länk'}
                                </button>
                              )}
                              <button
                                onClick={() => router.push(`/results/${survey.id}`)}
                                className="text-xs text-white/40 hover:text-white transition-colors"
                              >
                                Visa →
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
