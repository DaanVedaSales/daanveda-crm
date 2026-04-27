import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/sdrs — returns active SDRs (any authenticated user can call this)
// Used by Closer Today's Actions reschedule flow to populate SDR reassignment dropdown.
export async function GET() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('users')
    .select('id, name')
    .eq('role', 'sdr')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
