import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Survey, ConfirmState } from '../_helpers'
import { HeaderBar } from './HeaderBar'
import { PageHeader } from './PageHeader'
import { CreateLinkModal } from './CreateLinkModal'
import { PdfUploadModal } from './PdfUploadModal'
import { InviteModal } from './InviteModal'
import { VouchersPanel } from './VouchersPanel'
import { StatsCards } from './StatsCards'
import { SearchBar } from './SearchBar'
import { SurveyList, type BrfGroup } from './SurveyList'
import { ArchivedSurveys } from './ArchivedSurveys'
import { ConfirmModal } from './ConfirmModal'

// Regressionsskydd för #7 (dekomponering av admin/page.tsx). Det fanns
// inga komponenttester och admin-sidan kräver superadmin-inloggning som
// inte kan automatiseras. Dessa renderar varje utbruten komponent med
// representativ data via renderToStaticMarkup och verifierar att de
// renderar utan att kasta + att nyckelmarkup/branches finns kvar.

const noop = () => {}

const survey = (over: Partial<Survey> = {}): Survey => ({
  id: 's1',
  survey_year: 2024,
  status: 'completed',
  brf_name: 'BRF Solgläntan',
  token: 'tok-1',
  version: 1,
  created_at: '2024-03-01T00:00:00Z',
  deleted_at: null,
  kpi_results: [{ kpi_number: 1, value: 10, traffic_light: 'green' }],
  ...over,
})

describe('admin/_components – render-smoketester', () => {
  it('HeaderBar visar e-post + logga ut', () => {
    const h = renderToStaticMarkup(<HeaderBar userEmail="a@b.se" onLogout={noop} />)
    expect(h).toContain('a@b.se')
    expect(h).toContain('Logga ut')
    expect(h).toContain('Superadmin')
  })

  it('PageHeader visar antal + alla åtgärdsknappar', () => {
    const h = renderToStaticMarkup(
      <PageHeader surveysCount={7} onUploadPdf={noop} onCreateLink={noop} onToggleInvite={noop} onToggleVouchers={noop} />
    )
    expect(h).toContain('7 enkäter totalt')
    expect(h).toContain('Skapa enkätlänk')
    expect(h).toContain('Bjud in BRF-admin')
    expect(h).toContain('Vouchers')
  })

  it('StatsCards räknar totalt/genomförda/unika BRF', () => {
    const h = renderToStaticMarkup(
      <StatsCards surveys={[survey(), survey({ id: 's2', status: 'open', brf_name: 'BRF Andra 2023' })]} />
    )
    expect(h).toContain('Totalt antal enkäter')
    expect(h).toContain('Unika BRF:er')
  })

  it('SearchBar renderar år-options och rensa-knapp vid aktiv filtrering', () => {
    const empty = renderToStaticMarkup(
      <SearchBar searchQuery="" searchYear="" availableYears={[2024, 2023]} onSearchQuery={noop} onSearchYear={noop} onClear={noop} />
    )
    expect(empty).toContain('Alla år')
    expect(empty).not.toContain('Rensa')
    const active = renderToStaticMarkup(
      <SearchBar searchQuery="sol" searchYear="" availableYears={[2024]} onSearchQuery={noop} onSearchYear={noop} onClear={noop} />
    )
    expect(active).toContain('Rensa')
  })

  it('CreateLinkModal – båda lägen (formulär / skapad länk)', () => {
    const form = renderToStaticMarkup(
      <CreateLinkModal createdLink="" newBrfName="" creating={false} onNewBrfName={noop} onGenerate={noop} onCancel={noop} onCloseReset={noop} />
    )
    expect(form).toContain('Generera länk')
    const done = renderToStaticMarkup(
      <CreateLinkModal createdLink="https://x/survey?token=1" newBrfName="" creating={false} onNewBrfName={noop} onGenerate={noop} onCancel={noop} onCloseReset={noop} />
    )
    expect(done).toContain('Länk skapad')
    expect(done).toContain('https://x/survey?token=1')
  })

  it('PdfUploadModal – före och efter extraktion', () => {
    const pre = renderToStaticMarkup(
      <PdfUploadModal pdfFile={null} pdfExtracting={false} pdfExtracted={null} pdfConfidence={null} pdfNotes="" pdfError="" pdfSubmitting={false} onPdfFile={noop} onExtract={noop} onSubmit={noop} onCancel={noop} onReanalyze={noop} onAbortFromReview={noop} />
    )
    expect(pre).toContain('Analysera PDF')
    const post = renderToStaticMarkup(
      <PdfUploadModal pdfFile={null} pdfExtracting={false} pdfExtracted={{ brf_name: 'BRF X', A1_year: 2024 }} pdfConfidence={{ A1_year: 'high' }} pdfNotes="noter" pdfError="" pdfSubmitting={false} onPdfFile={noop} onExtract={noop} onSubmit={noop} onCancel={noop} onReanalyze={noop} onAbortFromReview={noop} />
    )
    expect(post).toContain('Godkänn och beräkna')
    expect(post).toContain('A1_year')
    expect(post).toContain('Säker') // confLabel('high')
  })

  it('InviteModal renderar fält + skicka', () => {
    const h = renderToStaticMarkup(
      <InviteModal inviteEmail="x@y.se" inviteBrf="" inviting={false} inviteMsg="Inbjudan skickad till x@y.se" onInviteEmail={noop} onInviteBrf={noop} onSend={noop} onClose={noop} />
    )
    expect(h).toContain('Skicka inbjudan')
    expect(h).toContain('Inbjudan skickad')
  })

  it('VouchersPanel listar befintliga vouchers', () => {
    const h = renderToStaticMarkup(
      <VouchersPanel
        vouchers={[{ id: 'v1', code: 'GRATIS', discount_percent: 100, max_uses: 1, times_used: 0, valid_until: null }]}
        newVoucherCode="" newVoucherDiscount={100} newVoucherMaxUses={1} creatingVoucher={false} voucherMsg=""
        onNewVoucherCode={noop} onNewVoucherDiscount={noop} onNewVoucherMaxUses={noop} onCreate={noop} onClose={noop}
      />
    )
    expect(h).toContain('GRATIS')
    expect(h).toContain('Helt gratis')
    expect(h).toContain('Aktiv')
  })

  it('SurveyList – loading / tom / inga träffar / grupperad multi-år', () => {
    expect(renderToStaticMarkup(
      <SurveyList loading={true} surveysCount={0} grouped={[]} expandedBrf={new Set()} copiedId={null} countPaid={() => 0} onToggleExpand={noop} onCopyLink={noop} onView={noop} onConfirm={noop} />
    )).toContain('Laddar...')
    expect(renderToStaticMarkup(
      <SurveyList loading={false} surveysCount={0} grouped={[]} expandedBrf={new Set()} copiedId={null} countPaid={() => 0} onToggleExpand={noop} onCopyLink={noop} onView={noop} onConfirm={noop} />
    )).toContain('Inga enkäter ännu')
    expect(renderToStaticMarkup(
      <SurveyList loading={false} surveysCount={3} grouped={[]} expandedBrf={new Set()} copiedId={null} countPaid={() => 0} onToggleExpand={noop} onCopyLink={noop} onView={noop} onConfirm={noop} />
    )).toContain('Inga träffar')
    const group: BrfGroup = { name: 'BRF Solgläntan', surveys: [survey({ id: 'a', survey_year: 2024 }), survey({ id: 'b', survey_year: 2023 })] }
    const h = renderToStaticMarkup(
      <SurveyList loading={false} surveysCount={2} grouped={[group]} expandedBrf={new Set(['BRF Solgläntan'])} copiedId={'a'} countPaid={() => 1} onToggleExpand={noop} onCopyLink={noop} onView={noop} onConfirm={noop} />
    )
    expect(h).toContain('BRF Solgläntan')
    expect(h).toContain('2 år')
    expect(h).toContain('✓ Kopierad')
  })

  it('ArchivedSurveys – utfälld med betald-markering', () => {
    const h = renderToStaticMarkup(
      <ArchivedSurveys
        archivedSurveys={[survey({ id: 'a', deleted_at: '2024-04-01T00:00:00Z' })]}
        showArchived={true} paidSurveyIds={['a']} countPaid={() => 1} onToggleArchived={noop} onConfirm={noop}
      />
    )
    expect(h).toContain('Arkiverade enkäter (1)')
    expect(h).toContain('betald rapport')
    expect(h).toContain('Radera permanent')
  })

  it('ConfirmModal – archive / hard_delete / restore', () => {
    const base = { confirmInput: '', processing: false, actionMsg: '', onConfirmInput: noop, onExecute: noop, onCancel: noop }
    const arch: NonNullable<ConfirmState> = { action: 'archive', scope: 'survey', expectedName: 'BRF X', label: 'Arkivera BRF X', paidCount: 0 }
    expect(renderToStaticMarkup(<ConfirmModal confirmState={arch} {...base} />)).toContain('Arkivera enkät')
    const del: NonNullable<ConfirmState> = { action: 'hard_delete', scope: 'survey', expectedName: 'BRF X', label: 'Radera BRF X PERMANENT', paidCount: 2 }
    const dh = renderToStaticMarkup(<ConfirmModal confirmState={del} {...base} />)
    expect(dh).toContain('Detta går INTE att ångra')
    expect(dh).toContain('betalda rapporter berörs')
    const res: NonNullable<ConfirmState> = { action: 'restore', scope: 'survey', expectedName: 'BRF X', label: 'Återställ BRF X', paidCount: 0 }
    expect(renderToStaticMarkup(<ConfirmModal confirmState={res} {...base} />)).toContain('Återställ enkät')
  })
})
