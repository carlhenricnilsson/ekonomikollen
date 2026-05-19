import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { requireSuperadmin } from '@/lib/auth'
import { parseBody, inviteSchema } from '@/lib/validation'

export async function POST(req: NextRequest) {
  const auth = await requireSuperadmin(req)
  if ('error' in auth) return auth.error

  const parsed = parseBody(inviteSchema, await req.json())
  if (!parsed.ok) return parsed.res
  const { email, brf_base_name } = parsed.data
  const invited_by = auth.userId // verifierad superadmin, inte klient-data

  const { data, error } = await supabaseAdmin
    .from('invitations')
    .insert({
      email: email.toLowerCase(),
      brf_base_name: brf_base_name || null,
      invited_by,
    })
    .select()
    .single()

  if (error) {
    console.error('Invitation error:', error)
    return NextResponse.json({ error: 'Kunde inte skapa inbjudan' }, { status: 500 })
  }

  // Om användaren redan har ett konto, koppla BRF direkt.
  // listUsers() saknar e-postfilter → paginera (annars missas
  // användare bortom första sidan ~50 och kopplingen sker tyst aldrig).
  if (brf_base_name) {
    let existingUserId: string | null = null
    let page = 1
    const perPage = 1000
    while (true) {
      const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
      if (listErr || !list) break
      const match = list.users.find(u => (u.email ?? '').toLowerCase() === email.toLowerCase())
      if (match) { existingUserId = match.id; break }
      if (list.users.length < perPage) break
      page++
    }

    if (existingUserId) {
      await supabaseAdmin.from('brf_admin_brfs').upsert({
        user_id: existingUserId,
        brf_base_name,
      }, { onConflict: 'user_id,brf_base_name' })

      await supabaseAdmin.from('invitations').update({ accepted: true }).eq('id', data.id)
    }
  }

  return NextResponse.json({ success: true, invitation: data })
}
