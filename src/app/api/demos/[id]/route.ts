import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// PATCH /api/demos/:id — update demo status, reminder_sent, post-demo notes
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { status, post_demo_notes, closer_id, reminder_sent, reschedule_date } = body

  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (status !== undefined) updatePayload.status = status
  if (post_demo_notes !== undefined) updatePayload.post_demo_notes = post_demo_notes
  if (closer_id !== undefined) updatePayload.closer_id = closer_id
  if (reminder_sent !== undefined) updatePayload.reminder_sent = reminder_sent
  // If rescheduling, update demo_date and set status to rescheduled
  if (reschedule_date) {
    updatePayload.demo_date = reschedule_date
    updatePayload.status = 'rescheduled'
  }

  const { data, error } = await supabase
    .from('demos')
    .update(updatePayload)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If marked attended: move deal from demo_scheduled → demo_done + log activity
  if (status === 'attended') {
    const actorId = (await supabase.from('users').select('id').eq('auth_id', user.id).single()).data?.id ?? ''
    await Promise.all([
      supabase.from('deals')
        .update({ stage: 'demo_done', updated_at: new Date().toISOString() })
        .eq('demo_id', params.id),
      supabase.from('activities').insert({
        lead_id: data.lead_id,
        org_id: data.org_id,
        user_id: actorId,
        activity_type: 'note',
        notes: `Demo attended. ${post_demo_notes ? `Notes: ${post_demo_notes}` : ''}`,
        new_value: 'demo_attended',
      }),
    ])
  }

  if (status === 'no_show') {
    await supabase.from('activities').insert({
      lead_id: data.lead_id,
      org_id: data.org_id,
      user_id: (await supabase.from('users').select('id').eq('auth_id', user.id).single()).data?.id ?? '',
      activity_type: 'note',
      notes: 'Demo no-show — org did not attend.',
      new_value: 'demo_no_show',
    })
  }

  return NextResponse.json(data)
}
