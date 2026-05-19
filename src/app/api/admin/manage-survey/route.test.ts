import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

vi.mock('@/lib/supabase-server', async () => {
  const h = await import('@/test/route-helpers')
  return { supabaseAdmin: h.supabaseAdmin }
})
vi.mock('@/lib/auth', () => ({ requireSuperadmin: vi.fn() }))

import { POST } from './route'
import { requireSuperadmin } from '@/lib/auth'
import { setSpec, makeReq, calls, QState } from '@/test/route-helpers'

const mockAuth = vi.mocked(requireSuperadmin)

beforeEach(() => {
  mockAuth.mockReset()
  mockAuth.mockResolvedValue({ userId: 'admin1' }) // default: behörig superadmin
})

const survey = { id: 's1', brf_name: 'BRF Test', survey_year: 2025, deleted_at: null }

describe('POST /api/admin/manage-survey', () => {
  it('ej superadmin → returnerar auth-felet (403)', async () => {
    mockAuth.mockResolvedValue({ error: NextResponse.json({ error: 'Endast superadmin' }, { status: 403 }) })
    setSpec({})
    expect((await POST(makeReq({ body: { action: 'archive', scope: 'survey', survey_id: 's1' } }))).status).toBe(403)
  })

  it('ogiltig action → 400', async () => {
    setSpec({})
    expect((await POST(makeReq({ body: { action: 'nuke', scope: 'survey', survey_id: 's1' } }))).status).toBe(400)
  })

  it('ogiltig scope → 400', async () => {
    setSpec({})
    expect((await POST(makeReq({ body: { action: 'archive', scope: 'galaxy' } }))).status).toBe(400)
  })

  it('survey saknas → 404', async () => {
    setSpec({ surveys: () => ({ data: null }) })
    expect((await POST(makeReq({ body: { action: 'archive', scope: 'survey', survey_id: 's1' } }))).status).toBe(404)
  })

  it('archive: fel bekräftelsenamn → 400', async () => {
    setSpec({ surveys: () => ({ data: survey }) })
    const res = await POST(makeReq({ body: { action: 'archive', scope: 'survey', survey_id: 's1', confirm_name: 'FEL' } }))
    expect(res.status).toBe(400)
  })

  it('archive: rätt namn (case-insensitivt) → deleted_at sätts, archived:1', async () => {
    setSpec({ surveys: (s: QState) => (s.single ? { data: survey } : {}) })
    const j = await (await POST(makeReq({ body: { action: 'archive', scope: 'survey', survey_id: 's1', confirm_name: 'brf test' } }))).json()
    expect(j).toEqual({ ok: true, archived: 1 })
    const upd = calls.find(c => c.table === 'surveys' && c.op === 'update')
    expect((upd?.payload as { deleted_at: string }).deleted_at).toBeTruthy()
  })

  it('archive redan arkiverad → 409', async () => {
    setSpec({ surveys: () => ({ data: { ...survey, deleted_at: '2026-01-01' } }) })
    const res = await POST(makeReq({ body: { action: 'archive', scope: 'survey', survey_id: 's1', confirm_name: 'BRF Test' } }))
    expect(res.status).toBe(409)
  })

  it('hard_delete på ej arkiverad → 409', async () => {
    setSpec({ surveys: () => ({ data: survey }) })
    const res = await POST(makeReq({ body: { action: 'hard_delete', scope: 'survey', survey_id: 's1', confirm_name: 'BRF Test' } }))
    expect(res.status).toBe(409)
  })

  it('hard_delete arkiverad + betald rapport utan force → 409 paid_report', async () => {
    setSpec({
      surveys: () => ({ data: { ...survey, deleted_at: '2026-01-01' } }),
      payments: (s: QState) => (s.op === 'select' ? { data: [{ id: 'p1', survey_id: 's1' }] } : {}),
    })
    const res = await POST(makeReq({ body: { action: 'hard_delete', scope: 'survey', survey_id: 's1', confirm_name: 'BRF Test' } }))
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('paid_report')
  })

  it('hard_delete arkiverad + force → raderar barn + survey', async () => {
    setSpec({
      surveys: (s: QState) => (s.single ? { data: { ...survey, deleted_at: '2026-01-01' } } : {}),
      payments: (s: QState) => (s.op === 'select' ? { data: [] } : {}),
      ai_analyses: () => ({}), kpi_results: () => ({}), answers: () => ({}),
    })
    const j = await (await POST(makeReq({ body: { action: 'hard_delete', scope: 'survey', survey_id: 's1', confirm_name: 'BRF Test', force: true } }))).json()
    expect(j).toEqual({ ok: true, hard_deleted: 1, paid_reports_removed: 0 })
    for (const t of ['ai_analyses', 'kpi_results', 'answers', 'payments', 'surveys']) {
      expect(calls.find(c => c.table === t && c.op === 'delete')).toBeDefined()
    }
  })

  it('restore på ej arkiverad → 409', async () => {
    setSpec({ surveys: () => ({ data: survey }) })
    const res = await POST(makeReq({ body: { action: 'restore', scope: 'survey', survey_id: 's1', confirm_name: 'BRF Test' } }))
    expect(res.status).toBe(409)
  })

  // Regression: UI:t döljer bekräftelsefältet för restore och skickar
  // confirm_name: "" – tidigare blockerade route:n detta med 400 så att
  // återställning ALDRIG kunde lyckas från gränssnittet.
  it('restore av arkiverad UTAN confirm_name (så UI:t skickar) → 200 restored:1, deleted_at=null', async () => {
    setSpec({ surveys: (s: QState) => (s.single ? { data: { ...survey, deleted_at: '2026-01-01' } } : {}) })
    const j = await (await POST(makeReq({ body: { action: 'restore', scope: 'survey', survey_id: 's1', confirm_name: '' } }))).json()
    expect(j).toEqual({ ok: true, restored: 1 })
    const upd = calls.find(c => c.table === 'surveys' && c.op === 'update')
    expect((upd?.payload as { deleted_at: null }).deleted_at).toBeNull()
  })

  // Skyddsräcke: destruktiva åtgärder kräver fortfarande exakt bekräftelsenamn.
  it('archive UTAN confirm_name → fortfarande 400 (destruktivt, oförändrat)', async () => {
    setSpec({ surveys: () => ({ data: survey }) })
    const res = await POST(makeReq({ body: { action: 'archive', scope: 'survey', survey_id: 's1', confirm_name: '' } }))
    expect(res.status).toBe(400)
  })
})
