import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const { user_id, email } = await req.json()

  if (!user_id || !email) {
    return NextResponse.json({ error: 'Saknar data' }, { status: 400 })
  }

  // Skapa user_profile som brf_admin
  await supabaseAdmin.from('user_profiles').upsert({
    id: user_id,
    role: 'brf_admin',
  }, { onConflict: 'id' })

  // Kolla om det finns inbjudningar för denna e-post
  const { data: invitations } = await supabaseAdmin
    .from('invitations')
    .select('*')
    .eq('email', email.toLowerCase())
    .eq('accepted', false)

  if (invitations && invitations.length > 0) {
    for (const inv of invitations) {
      if (inv.brf_base_name) {
        await supabaseAdmin.from('brf_admin_brfs').upsert({
          user_id,
          brf_base_name: inv.brf_base_name,
        }, { onConflict: 'user_id,brf_base_name' })
      }
      await supabaseAdmin.from('invitations').update({ accepted: true }).eq('id', inv.id)
    }
  }

  return NextResponse.json({ success: true })
}
