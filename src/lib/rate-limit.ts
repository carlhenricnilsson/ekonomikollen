// ============================================================
// Lätt in-memory rate limiter (glidande fönster) per IP + route.
//
// OBS: I serverless (Vercel) är minnet per-instans, inte globalt
// delat – detta är best-effort och bromsar burst-abuse / API-
// kostnad rejält, men ger inte strikt globalt tak. För strikt
// globalt: Upstash Redis / Vercel KV (framtida härdning).
// ============================================================

import { NextRequest, NextResponse } from 'next/server'

const hits = new Map<string, number[]>()

function clientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return req.headers.get('x-real-ip') || 'unknown'
}

// Returnerar en 429-NextResponse om gränsen överskridits, annars null.
export function rateLimit(
  req: NextRequest,
  routeKey: string,
  limit: number,
  windowMs: number
): NextResponse | null {
  const key = `${routeKey}:${clientIp(req)}`
  const now = Date.now()
  const cutoff = now - windowMs

  const recent = (hits.get(key) ?? []).filter(t => t > cutoff)

  if (recent.length >= limit) {
    const retryAfter = Math.ceil((recent[0] + windowMs - now) / 1000)
    return NextResponse.json(
      { error: 'För många förfrågningar – försök igen om en stund' },
      { status: 429, headers: { 'Retry-After': String(Math.max(1, retryAfter)) } }
    )
  }

  recent.push(now)
  hits.set(key, recent)

  // Enkel storleksgräns så minnet inte växer obegränsat
  if (hits.size > 5000) {
    for (const [k, ts] of hits) {
      if (ts.every(t => t <= cutoff)) hits.delete(k)
    }
  }

  return null
}

// Endast för tester – nollställ state mellan fall
export function __resetRateLimit() {
  hits.clear()
}
