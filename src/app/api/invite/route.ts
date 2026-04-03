import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const { email, brf_base_name, invited_by } = await req.json()

  if (!email) {
    return NextResponse.json({ error: 'E-post krävs' }, { status: 400 })
  }

  // Kolla om redan inbjuden
  const { data: existing } = await supabaseAdmin
    .from('invitations')
    .select('id')
    .eq('email', email.toLowerCase())
    .eq('accepted', false)
    .limit(1)

  if (existing && existing.length > 0 && brf_base_name) {
    // Uppdatera befintlig inbjudan med ny BRF om det behövs
  }

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

  // Om användaren redan har ett konto, koppla BRF direkt
  if (brf_base_name) {
    const { data: existingUser } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('id', (await supabaseAdmin.auth.admin.listUsers()).data.users.find(u => u.email === email.toLowerCase())?.id ?? '')
      .single()

    if (existingUser) {
      await supabaseAdmin.from('brf_admin_brfs').upsert({
        user_id: existingUser.id,
        brf_base_name,
      }, { onConflict: 'user_id,brf_base_name' })

      await supabaseAdmin.from('invitations').update({ accepted: true }).eq('id', data.id)
    }
  }

  return NextResponse.json({ success: true, invitation: data })
}
