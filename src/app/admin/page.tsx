'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase-client'

import { type Survey, type ConfirmState } from './_helpers'
import { HeaderBar } from './_components/HeaderBar'
import { PageHeader } from './_components/PageHeader'
import { CreateLinkModal } from './_components/CreateLinkModal'
import { PdfUploadModal } from './_components/PdfUploadModal'
import { InviteModal } from './_components/InviteModal'
import { VouchersPanel } from './_components/VouchersPanel'
import { StatsCards } from './_components/StatsCards'
import { SearchBar } from './_components/SearchBar'
import { SurveyList, type BrfGroup } from './_components/SurveyList'
import { ArchivedSurveys } from './_components/ArchivedSurveys'
import { ConfirmModal } from './_components/ConfirmModal'

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
  // Arkivering / radering
  const [confirmState, setConfirmState] = useState<ConfirmState>(null)
  const [confirmInput, setConfirmInput] = useState('')
  const [processing, setProcessing] = useState(false)
  const [actionMsg, setActionMsg] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [paidSurveyIds, setPaidSurveyIds] = useState<string[]>([])

  useEffect(() => {
    checkAuth()
    fetchSurveys()
  }, [])

  async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setUserEmail(user.email ?? '')

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

    // Hämta vilka enkäter som har en genomförd betalning (för varning vid radering)
    const { data: payments } = await supabase
      .from('payments')
      .select('survey_id')
      .eq('status', 'completed')
    setPaidSurveyIds([...new Set((payments ?? []).map((p: { survey_id: string }) => p.survey_id))])

    setLoading(false)
  }

  // Auth-headers för superadmin-skyddade API-anrop
  async function authHeaders(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession()
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token ?? ''}`,
    }
  }

  // Endast Authorization (för FormData – Content-Type sätts av webbläsaren)
  async function bearerOnly(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession()
    return { Authorization: `Bearer ${session?.access_token ?? ''}` }
  }

  async function createSurveyLink() {
    setCreating(true)
    // Skicka bara brf_name – API:et normaliserar namn och extraherar år
    const res = await fetch('/api/create-survey-link', {
      method: 'POST',
      headers: await authHeaders(),
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
      headers: await authHeaders(),
      body: JSON.stringify({ email: inviteEmail, brf_base_name: inviteBrf || null }),
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
    const res = await fetch('/api/vouchers', { headers: await authHeaders() })
    const data = await res.json()
    setVouchers(data.vouchers ?? [])
  }

  async function createVoucher() {
    setCreatingVoucher(true)
    setVoucherMsg('')
    const res = await fetch('/api/vouchers', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({
        code: newVoucherCode,
        discount_percent: newVoucherDiscount,
        max_uses: newVoucherMaxUses,
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
      const res = await fetch('/api/extract-pdf', { method: 'POST', headers: await bearerOnly(), body: form })
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
        headers: await authHeaders(),
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

  const filteredSurveys = surveys.filter(s => {
    if (s.deleted_at) return false // arkiverade visas i separat sektion
    const nameMatch = searchQuery === '' || (s.brf_name ?? '').toLowerCase().includes(searchQuery.toLowerCase())
    const yearMatch = searchYear === '' || String(s.survey_year) === searchYear
    return nameMatch && yearMatch
  })

  const archivedSurveys = surveys
    .filter(s => s.deleted_at)
    .sort((a, b) => {
      const nameA = (a.brf_name ?? '').toLowerCase()
      const nameB = (b.brf_name ?? '').toLowerCase()
      if (nameA !== nameB) return nameA < nameB ? -1 : 1
      return b.survey_year - a.survey_year
    })

  // Räknar genomförda betalningar för en uppsättning enkäter
  function countPaid(surveyIds: string[]): number {
    return paidSurveyIds.filter(id => surveyIds.includes(id)).length
  }

  function openConfirm(cs: NonNullable<ConfirmState>) {
    setConfirmInput('')
    setActionMsg('')
    setConfirmState(cs)
  }

  async function executeAction(force = false) {
    if (!confirmState) return
    setProcessing(true)
    setActionMsg('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/manage-survey', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({
          action: confirmState.action,
          scope: confirmState.scope,
          survey_id: confirmState.surveyId,
          brf_base_name: confirmState.brfBaseName,
          confirm_name: confirmInput,
          force,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === 'paid_report') {
          // Visa förstärkt varning, kräv extra bekräftelse
          setConfirmState({ ...confirmState, paidCount: data.paid_count })
          setActionMsg(`⚠️ ${data.message}`)
          setProcessing(false)
          return
        }
        setActionMsg(`Fel: ${data.error ?? 'okänt fel'}`)
        setProcessing(false)
        return
      }
      setConfirmState(null)
      setConfirmInput('')
      await fetchSurveys()
      setActionMsg('')
    } catch (err) {
      setActionMsg(`Fel: ${err instanceof Error ? err.message : 'okänt'}`)
    }
    setProcessing(false)
  }

  const availableYears = [...new Set(surveys.map(s => s.survey_year))].sort((a, b) => b - a)

  // Gruppera undersökningar per BRF-namn
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

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <HeaderBar userEmail={userEmail} onLogout={handleLogout} />

      <div className="max-w-5xl mx-auto px-6 py-10">
        <PageHeader
          surveysCount={surveys.length}
          onUploadPdf={() => { setShowPdfUpload(true); setPdfFile(null); setPdfExtracted(null); setPdfError('') }}
          onCreateLink={() => { setShowCreateLink(true); setCreatedLink('') }}
          onToggleInvite={() => setShowInvite(!showInvite)}
          onToggleVouchers={() => { setShowVouchers(!showVouchers); if (!showVouchers) fetchVouchers() }}
        />

        {showCreateLink && (
          <CreateLinkModal
            createdLink={createdLink}
            newBrfName={newBrfName}
            creating={creating}
            onNewBrfName={setNewBrfName}
            onGenerate={createSurveyLink}
            onCancel={() => setShowCreateLink(false)}
            onCloseReset={() => { setShowCreateLink(false); setCreatedLink(''); setNewBrfName('') }}
          />
        )}

        {showPdfUpload && (
          <PdfUploadModal
            pdfFile={pdfFile}
            pdfExtracting={pdfExtracting}
            pdfExtracted={pdfExtracted}
            pdfConfidence={pdfConfidence}
            pdfNotes={pdfNotes}
            pdfError={pdfError}
            pdfSubmitting={pdfSubmitting}
            onPdfFile={(f) => setPdfFile(f)}
            onExtract={extractPdf}
            onSubmit={submitExtracted}
            onCancel={() => setShowPdfUpload(false)}
            onReanalyze={() => { setPdfExtracted(null); setPdfConfidence(null); setPdfNotes('') }}
            onAbortFromReview={() => { setShowPdfUpload(false); setPdfExtracted(null) }}
          />
        )}

        {showInvite && (
          <InviteModal
            inviteEmail={inviteEmail}
            inviteBrf={inviteBrf}
            inviting={inviting}
            inviteMsg={inviteMsg}
            onInviteEmail={setInviteEmail}
            onInviteBrf={setInviteBrf}
            onSend={sendInvite}
            onClose={() => setShowInvite(false)}
          />
        )}

        {showVouchers && (
          <VouchersPanel
            vouchers={vouchers}
            newVoucherCode={newVoucherCode}
            newVoucherDiscount={newVoucherDiscount}
            newVoucherMaxUses={newVoucherMaxUses}
            creatingVoucher={creatingVoucher}
            voucherMsg={voucherMsg}
            onNewVoucherCode={setNewVoucherCode}
            onNewVoucherDiscount={setNewVoucherDiscount}
            onNewVoucherMaxUses={setNewVoucherMaxUses}
            onCreate={createVoucher}
            onClose={() => setShowVouchers(false)}
          />
        )}

        <StatsCards surveys={surveys} />

        {surveys.length > 0 && (
          <SearchBar
            searchQuery={searchQuery}
            searchYear={searchYear}
            availableYears={availableYears}
            onSearchQuery={setSearchQuery}
            onSearchYear={setSearchYear}
            onClear={() => { setSearchQuery(''); setSearchYear('') }}
          />
        )}

        <SurveyList
          loading={loading}
          surveysCount={surveys.length}
          grouped={grouped}
          expandedBrf={expandedBrf}
          copiedId={copiedId}
          countPaid={countPaid}
          onToggleExpand={(name) => {
            setExpandedBrf(prev => {
              const next = new Set(prev)
              next.has(name) ? next.delete(name) : next.add(name)
              return next
            })
          }}
          onCopyLink={copyLink}
          onView={(id) => router.push(`/results/${id}`)}
          onConfirm={openConfirm}
        />

        {archivedSurveys.length > 0 && (
          <ArchivedSurveys
            archivedSurveys={archivedSurveys}
            showArchived={showArchived}
            paidSurveyIds={paidSurveyIds}
            countPaid={countPaid}
            onToggleArchived={() => setShowArchived(v => !v)}
            onConfirm={openConfirm}
          />
        )}
      </div>

      {confirmState && (
        <ConfirmModal
          confirmState={confirmState}
          confirmInput={confirmInput}
          processing={processing}
          actionMsg={actionMsg}
          onConfirmInput={setConfirmInput}
          onExecute={() => executeAction(confirmState.paidCount > 0)}
          onCancel={() => { setConfirmState(null); setConfirmInput(''); setActionMsg('') }}
        />
      )}
    </div>
  )
}
