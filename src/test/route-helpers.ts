// ============================================================
// Testhjälpmedel för API-route-tester (pengaflödet).
// Chainable Supabase-mock + Stripe-mock + request-byggare.
// Inga riktiga nätverksanrop – allt deterministiskt.
// ============================================================

export type QState = {
  table: string
  op: 'select' | 'insert' | 'update' | 'upsert' | 'delete'
  payload?: unknown
  opts?: unknown
  filters: [string, string, unknown][]
  single?: boolean
}

export type TableResult = { data?: unknown; error?: unknown }
// Handler får query-tillståndet och returnerar { data, error }
export type Spec = Record<string, (s: QState) => TableResult | Promise<TableResult>>

let activeSpec: Spec = {}
export const calls: QState[] = []

export function setSpec(spec: Spec) {
  activeSpec = spec
  calls.length = 0
}

function makeBuilder(table: string) {
  const state: QState = { table, op: 'select', filters: [] }
  const resolve = async (single: boolean) => {
    state.single = single
    calls.push({ ...state, filters: [...state.filters] })
    const handler = activeSpec[table]
    const r: TableResult = handler ? await handler(state) : {}
    return { data: r.data ?? (single ? null : []), error: r.error ?? null }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b: any = {
    select: () => b,
    insert: (p: unknown) => { state.op = 'insert'; state.payload = p; return b },
    update: (p: unknown) => { state.op = 'update'; state.payload = p; return b },
    upsert: (p: unknown, o: unknown) => { state.op = 'upsert'; state.payload = p; state.opts = o; return b },
    delete: () => { state.op = 'delete'; return b },
    eq: (c: string, v: unknown) => { state.filters.push(['eq', c, v]); return b },
    in: (c: string, v: unknown) => { state.filters.push(['in', c, v]); return b },
    is: (c: string, v: unknown) => { state.filters.push(['is', c, v]); return b },
    not: (c: string, _o: string, v: unknown) => { state.filters.push(['not', c, v]); return b },
    ilike: (c: string, v: unknown) => { state.filters.push(['ilike', c, v]); return b },
    order: () => b,
    limit: () => b,
    single: () => resolve(true),
    then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
      resolve(false).then(res, rej),
  }
  return b
}

export const supabaseAdmin = { from: (t: string) => makeBuilder(t) }

// ---- Stripe-mock ----
let stripeSessionsCreate: (args: unknown) => Promise<unknown> = async () => ({
  id: 'cs_test_mock',
  url: 'https://checkout.stripe.com/c/pay/cs_test_mock',
})
let stripeConstructEvent: (body: string, sig: string, secret: string) => unknown = () => {
  throw new Error('constructEvent ej konfigurerad i test')
}

export function setStripe(opts: {
  sessionsCreate?: (args: unknown) => Promise<unknown>
  constructEvent?: (body: string, sig: string, secret: string) => unknown
}) {
  if (opts.sessionsCreate) stripeSessionsCreate = opts.sessionsCreate
  if (opts.constructEvent) stripeConstructEvent = opts.constructEvent
}

export class StripeMock {
  checkout = { sessions: { create: (args: unknown) => stripeSessionsCreate(args) } }
  webhooks = {
    constructEvent: (b: string, s: string, sec: string) => stripeConstructEvent(b, s, sec),
  }
}

// ---- Request-byggare ----
export function makeReq(opts: {
  body?: unknown
  rawBody?: string
  headers?: Record<string, string>
  url?: string
}) {
  const headers = opts.headers ?? {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return {
    json: async () => opts.body ?? {},
    text: async () => opts.rawBody ?? JSON.stringify(opts.body ?? {}),
    headers: { get: (k: string) => headers[k] ?? headers[k.toLowerCase()] ?? null },
    nextUrl: new URL(opts.url ?? 'http://localhost/api/test'),
    url: opts.url ?? 'http://localhost/api/test',
  } as any
}
