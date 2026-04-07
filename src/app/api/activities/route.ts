import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/activities — log an activity
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { lead_id, activity_type, channel, outcome, notes, interest_signal, callback_date, follow_up_date } = body

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

  // Map outcome to lead status
  const statusMap: Record<string, string> = {
    'Demo Booked': 'demo_booked',
    'Not Interested': 'not_interested',
    'Call Again': 'call_again',
    'Not Reachable': 'not_reachable',
  }
  const newStatus = outcome ? statusMap[outcome] : undefined

  // Insert activity (immutable)
  const { data: activity, error: actError } = await supabase
    .from('activities')
    .insert({
      lead_id,
      org_id: lead.org_id,
      user_id: profile.id,
      activity_type,
      channel,
      outcome,
      notes,
      old_value: lead.status,
      new_value: newStatus ?? lead.status,
      metadata: { interest_signal },
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

  await supabase.from('leads').update(leadUpdate).eq('id', lead_id)

  return NextResponse.json(activity, { status: 201 })
}
