import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { rateLimit, __resetRateLimit } from './rate-limit'
import { makeReq } from '@/test/route-helpers'

const reqFrom = (ip: string) =>
  makeReq({ headers: { 'x-forwarded-for': ip } }) as unknown as Parameters<typeof rateLimit>[0]

beforeEach(() => {
  __resetRateLimit()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
})
afterEach(() => vi.useRealTimers())

describe('rateLimit', () => {
  it('tillåter upp till gränsen, blockerar däröver (429)', () => {
    const r = reqFrom('1.1.1.1')
    expect(rateLimit(r, 'k', 3, 60_000)).toBeNull()
    expect(rateLimit(r, 'k', 3, 60_000)).toBeNull()
    expect(rateLimit(r, 'k', 3, 60_000)).toBeNull()
    const blocked = rateLimit(r, 'k', 3, 60_000)
    expect(blocked).not.toBeNull()
    expect(blocked!.status).toBe(429)
    expect(blocked!.headers.get('Retry-After')).toBeTruthy()
  })

  it('olika IP räknas separat', () => {
    expect(rateLimit(reqFrom('1.1.1.1'), 'k', 1, 60_000)).toBeNull()
    expect(rateLimit(reqFrom('1.1.1.1'), 'k', 1, 60_000)).not.toBeNull() // över för IP1
    expect(rateLimit(reqFrom('2.2.2.2'), 'k', 1, 60_000)).toBeNull()     // IP2 opåverkad
  })

  it('olika route-nyckel räknas separat', () => {
    const r = reqFrom('1.1.1.1')
    expect(rateLimit(r, 'a', 1, 60_000)).toBeNull()
    expect(rateLimit(r, 'a', 1, 60_000)).not.toBeNull()
    expect(rateLimit(r, 'b', 1, 60_000)).toBeNull() // annan route ok
  })

  it('fönstret återställs när tiden gått', () => {
    const r = reqFrom('1.1.1.1')
    expect(rateLimit(r, 'k', 1, 1000)).toBeNull()
    expect(rateLimit(r, 'k', 1, 1000)).not.toBeNull() // blockerad inom fönstret
    vi.advanceTimersByTime(1100) // fönstret passerar
    expect(rateLimit(r, 'k', 1, 1000)).toBeNull() // tillåts igen
  })

  it('saknad IP-header → nyckel "unknown" (kraschar ej)', () => {
    const r = makeReq({}) as unknown as Parameters<typeof rateLimit>[0]
    expect(rateLimit(r, 'k', 1, 60_000)).toBeNull()
    expect(rateLimit(r, 'k', 1, 60_000)).not.toBeNull()
  })
})
