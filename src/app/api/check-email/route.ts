import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

// Kollar om en e-postadress redan är registrerad i auth.users
// (oavsett om kontot är verifierat eller inte)
export async function POST(req: NextRequest) {
  const { email } = await req.json()

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Saknar e-post' }, { status: 400 })
  }

  // Verifiera att service-role-nyckel finns
  if (!process.env.SUPABASE_SECRET_KEY) {
    console.error('[check-email] SUPABASE_SECRET_KEY saknas')
    return NextResponse.json(
      { error: 'Server-konfiguration saknas (SUPABASE_SECRET_KEY)' },
      { status: 500 }
    )
  }

  const normalized = email.trim().toLowerCase()

  try {
    let page = 1
    const perPage = 1000
    while (true) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
      if (error) {
        console.error('[check-email] listUsers error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      const found = data.users.find(u => (u.email ?? '').toLowerCase() === normalized)
      if (found) {
        return NextResponse.json({ exists: true })
      }
      if (data.users.length < perPage) break
      page++
    }
    return NextResponse.json({ exists: false })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[check-email] unexpected:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
