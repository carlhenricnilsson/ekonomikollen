import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

// Kollar om en e-postadress redan är registrerad i auth.users
// (oavsett om kontot är verifierat eller inte)
export async function POST(req: NextRequest) {
  const { email } = await req.json()

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Saknar e-post' }, { status: 400 })
  }

  const normalized = email.trim().toLowerCase()

  // listUsers stödjer inte filter på e-post direkt i alla versioner,
  // så vi paginerar och matchar. I praktiken räcker första sidan
  // för de flesta projekt, men vi loopar för säkerhets skull.
  let page = 1
  const perPage = 1000
  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
    if (error) {
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
}
