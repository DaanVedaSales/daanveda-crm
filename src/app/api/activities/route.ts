import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CHANNEL_TO_ACTIVITY_TYPE, NOT_INTERESTED_OUTCOMES, BANNED_OUTCOME, FOLLOWUP_OUTCOME } from '@/lib/constants'
import { notifyRole } from '@/lib/notifications'

// POST /api/activities — log an activity
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { lead_id, activity_type, channel, outcome, notes, interest_signal, callback_date, follow_up_date, follow_up_via } = body

  if (!lead_id || !activity_type) {
    return NextResponse.json({ error: 'lead_id and activity_type are required' }, { status: 400 })
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('users').select('id').eq('auth_id', user!.id).single()
  const { data: lead } = await supabase.from('leads').select('org_id, status, interest_signal').eq('id', lead_id).single()

  if (!lead || !profile) {
    return NextResponse.json({ error: 'Lead or user not found' }, { status: 404 })
  }

  // Resolve activity_type from the channel (fixes the old hardcoded 'call')
  const resolvedType = CHANNEL_TO_ACTIVITY_TYPE[channel as string] ?? activity_type ?? 'note'

  // Channel-aware outcome → lead status routing:
  //  - "Demo Booked"           → demo_booked
  //  - declined (Not interested) → not_interested
  //  - established + a date set  → follow_up  (established two-way contact → Follow-ups)
  //  - everything else           → contacted  (logged outbound/failed attempt, stays in My Leads)
  let newStatus: string | undefined
  if (outcome === 'Demo Booked') newStatus = 'demo_booked'
  else if (outcome && NOT_INTERESTED_OUTCOMES.includes(outcome)) newStatus = 'not_interested'
  else if (outcome === BANNED_OUTCOME) newStatus = undefined  // ban review handled by admin; lead left as-is for now
  else if (outcome === FOLLOWUP_OUTCOME) newStatus = 'follow_up'  // they responded & asked to follow up → Follow-ups
  else newStatus = 'contacted'  // logged outbound/failed attempt → stays in My Leads

  // Insert activity (immutable)
  const { data: activity, error: actError } = await supabase
    .from('activities')
    .insert({
      lead_id,
      org_id: lead.org_id,
      user_id: profile.id,
      activity_type: resolvedType,
      channel,
      outcome,
      notes,
      old_value: lead.status,
      new_value: newStatus ?? lead.status,
      metadata: { interest_signal, follow_up_via },
    })
    .select()
    .single()

  if (actError) return NextResponse.json({ error: actError.message }, { status: 500 })

  // Update lead with outcome, interest signal, and dates
  const leadUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (newStatus) leadUpdate.status = newStatus
  if (interest_signal) leadUpdate.interest_signal = interest_signal
  if (callback_date) leadUpdate.callback_date = callback_date
  if (follow_up_date) leadUpdate.follow_up_date = follow_up_date

  // Return-to-admin routing: a real decline, or a ban request, leaves the SDR side
  if (outcome && NOT_INTERESTED_OUTCOMES.includes(outcome)) {
    leadUpdate.phase = 'dead'
    leadUpdate.returned_reason = 'not_interested'
  } else if (outcome === BANNED_OUTCOME) {
    leadUpdate.phase = 'dead'
    leadUpdate.returned_reason = 'ban_requested'
  }

  await supabase.from('leads').update(leadUpdate).eq('id', lead_id)

  // On a ban request, notify admins to confirm (best-effort — never blocks the log).
  if (outcome === BANNED_OUTCOME) {
    const { data: orgRow } = await supabase.from('organizations').select('name').eq('id', lead.org_id).single()
    const { data: meRow } = await supabase.from('users').select('name').eq('id', profile.id).single()
    await notifyRole('admin', {
      actorId: profile.id,
      type: 'ban_requested',
      title: 'Ban requested',
      body: `${meRow?.name ?? 'An SDR'} requested to ban ${orgRow?.name ?? 'an organisation'}. Review in the Returned tab.`,
      link: '/admin/leads',
    })
  }

  return NextResponse.json(activity, { status: 201 })
}
