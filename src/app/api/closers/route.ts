import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET /api/closers — returns active closers (any authenticated user can call this)
// Used by SDR BookDemoModal to populate the closer dropdown.
// Returns only id + name — no sensitive data exposed.
export async function GET() {
  const authClient = createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('users')
    .select('id, name')
    .eq('role', 'closer')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
