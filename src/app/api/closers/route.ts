import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/closers — returns active closers (any authenticated user can call this)
// Used by SDR BookDemoModal to populate the closer dropdown.
// Returns only id + name — no sensitive data exposed.
// RLS policy "users_see_active_closers" allows any authenticated user to SELECT
// rows where role='closer' AND is_active=true, so no service role key needed here.
export async function GET() {
  const supabase = createClient()

  // Verify caller is authenticated
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // RLS permits this query for any authenticated user
  const { data, error } = await supabase
    .from('users')
    .select('id, name')
    .eq('role', 'closer')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
