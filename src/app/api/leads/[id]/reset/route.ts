import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/leads/:id/reset
// SDR action: return a mistakenly-progressed lead to a fresh 'assigned' state in My Leads.
// - status → 'assigned', phase → 'sdr'  (drops it out of Follow-ups, back into My Leads)
// - clears callback_date, follow_up_date, recycle_date, recycle_reason, returned_reason
// - PRESERVES interest_signal (the last read on the org is kept)
// - KEEPS activity history (we only insert an audit note, never delete activities)
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('id, role').eq('auth_id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: lead } = await supabase
    .from('leads').select('org_id, status, phase, assigned_to').eq('id', params.id).single()
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  // Only the owning SDR (or an admin) may reset; never reset a closer-phase lead.
  const isOwner = lead.assigned_to === profile.id
  if (!isOwner && profile.role !== 'admin') {
    return NextResponse.json({ error: 'You can only reset your own leads' }, { status: 403 })
  }
  if (lead.phase === 'closer') {
    return NextResponse.json({ error: 'Cannot reset a lead in closer phase' }, { status: 409 })
  }

  const { error: updateError } = await supabase
    .from('leads')
    .update({
      status: 'assigned',
      phase: 'sdr',
      callback_date: null,
      follow_up_date: null,
      recycle_date: null,
      recycle_reason: null,
      returned_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  // Immutable audit note — activity history is preserved, this just records the reset.
  await supabase.from('activities').insert({
    lead_id: params.id,
    org_id: lead.org_id,
    user_id: profile.id,
    activity_type: 'status_change',
    notes: 'Lead reset to fresh — returned to My Leads',
    old_value: lead.status,
    new_value: 'assigned',
  })

  return NextResponse.json({ success: true })
}
