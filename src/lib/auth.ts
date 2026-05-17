// ============================================================
// Delad server-side autentisering för API-routes.
// Tidigare copy-pastat (Authorization → getUser → role) i flera
// routes – nu en plats, ett konsekvent beteende.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-server'

export type UserRole = 'superadmin' | 'brf_admin' | 'anonymous'

export type ResolvedUser = { userId: string | null; role: UserRole }

// Läser Authorization-headern, verifierar sessionen mot Supabase och
// slår upp rollen i user_profiles. Avvisar ALDRIG – returnerar
// { userId: null, role: 'anonymous' } om token saknas/är ogiltig.
// (Inloggad användare utan profilrad antas vara 'brf_admin', som tidigare.)
export async function resolveUser(req: NextRequest): Promise<ResolvedUser> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return { userId: null, role: 'anonymous' }

  const supabaseUser = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    { global: { headers: { Authorization: authHeader } } }
  )
  const { data: { user } } = await supabaseUser.auth.getUser()
  if (!user) return { userId: null, role: 'anonymous' }

  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return { userId: user.id, role: (profile?.role ?? 'brf_admin') as UserRole }
}

// För endpoints som KRÄVER superadmin (destruktiva/admin-åtgärder).
// Returnerar { userId } vid behörig superadmin, annars { error }
// med en färdig NextResponse (401 ej inloggad / 403 fel roll) att
// early-returna. Server-side – lita ALDRIG på klienten.
export async function requireSuperadmin(
  req: NextRequest
): Promise<{ userId: string } | { error: NextResponse }> {
  const { userId, role } = await resolveUser(req)
  if (!userId) {
    return { error: NextResponse.json({ error: 'Ej inloggad' }, { status: 401 }) }
  }
  if (role !== 'superadmin') {
    return { error: NextResponse.json({ error: 'Endast superadmin' }, { status: 403 }) }
  }
  return { userId }
}
