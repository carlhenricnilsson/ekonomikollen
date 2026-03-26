import { createClient } from '@supabase/supabase-js'

// Används i API-routes (server-side) – kringgår RLS
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)
