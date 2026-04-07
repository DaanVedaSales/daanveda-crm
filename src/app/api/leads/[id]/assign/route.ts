import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/leads/:id/assign
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { to_user_id, reason } = await req.json()
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users').select('id, role').eq('auth_id', user!.id).single()

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Only admins can assign leads' }, { status: 403 })
  }

  const { data: lead } = await supabase.from('leads').select('assigned_to').eq('id', params.id).single()

  // Update lead assignment
  const { error: updateError } = await supabase
    .from('leads')
    .update({ assigned_to: to_user_id, assigned_by: profile.id, status: 'assigned', updated_at: new Date().toISOString() })
    .eq('id', params.id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  // Log assignment history
  await supabase.from('lead_assignments').insert({
    lead_id: params.id,
    from_user_id: lead?.assigned_to ?? null,
    to_user_id,
    assigned_by: profile.id,
    reason,
  })

  // Log activity
  await supabase.from('activities').insert({
    lead_id: params.id,
    org_id: (await supabase.from('leads').select('org_id').eq('id', params.id).single()).data?.org_id,
    user_id: profile.id,
    activity_type: 'assignment',
    notes: reason ?? 'Lead assigned',
  })

  return NextResponse.json({ success: true })
}
