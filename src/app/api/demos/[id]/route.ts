import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// PATCH /api/demos/:id — update demo status, reminder_sent, post-demo notes, reschedule, reassign
//
// Supported body fields:
//   status           'attended' | 'no_show' | 'rescheduled'
//   post_demo_notes  string
//   closer_id        uuid
//   reminder_sent    boolean
//   reschedule_date  ISO datetime — sets demo_date + status='rescheduled'
//   new_sdr_id       uuid — reassign SDR: updates demo.sdr_id + lead.assigned_to + returns lead to SDR workspace
//   new_closer_id    uuid — reassign Closer: updates demo.closer_id + deal.closer_id
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: actorProfile } = await supabase
    .from('users')
    .select('id, name')
    .eq('auth_id', user.id)
    .single()
  const actorId = actorProfile?.id ?? ''

  const body = await req.json()
  const {
    status,
    post_demo_notes,
    closer_id,
    reminder_sent,
    reschedule_date,
    new_sdr_id,
    new_closer_id,
  } = body

  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (status !== undefined) updatePayload.status = status
  if (post_demo_notes !== undefined) updatePayload.post_demo_notes = post_demo_notes
  if (closer_id !== undefined) updatePayload.closer_id = closer_id
  if (reminder_sent !== undefined) updatePayload.reminder_sent = reminder_sent

  // Reschedule: update date + set status
  if (reschedule_date) {
    updatePayload.demo_date = reschedule_date
    updatePayload.status = 'rescheduled'
  }

  // SDR reassignment — change who owns the SDR side
  if (new_sdr_id) updatePayload.sdr_id = new_sdr_id

  // Closer reassignment — change who owns the Closer side
  if (new_closer_id) updatePayload.closer_id = new_closer_id

  const { data, error } = await supabase
    .from('demos')
    .update(updatePayload)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const promises: Promise<unknown>[] = []

  // ── Attended ──────────────────────────────────────────────────────────────
  if (status === 'attended') {
    promises.push(
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
    )
  }

  // ── No Show ───────────────────────────────────────────────────────────────
  if (status === 'no_show') {
    promises.push(
      supabase.from('activities').insert({
        lead_id: data.lead_id,
        org_id: data.org_id,
        user_id: actorId,
        activity_type: 'note',
        notes: 'Demo no-show — org did not attend.',
        new_value: 'demo_no_show',
      }),
    )
  }

  // ── Reschedule activity log ────────────────────────────────────────────────
  if (reschedule_date) {
    const rescheduledTo = new Date(reschedule_date).toLocaleString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    })
    promises.push(
      supabase.from('activities').insert({
        lead_id: data.lead_id,
        org_id: data.org_id,
        user_id: actorId,
        activity_type: 'note',
        notes: `Demo rescheduled to ${rescheduledTo}.${new_sdr_id ? ` SDR reassigned.` : ''}${new_closer_id ? ` Closer reassigned.` : ''}`,
        new_value: 'demo_rescheduled',
      }),
    )
  }

  // ── SDR Reassignment ──────────────────────────────────────────────────────
  // Return lead back to the new SDR's Assigned Leads workspace
  if (new_sdr_id && data.lead_id) {
    // Fetch new SDR's name for activity note
    const { data: newSdr } = await supabase.from('users').select('name').eq('id', new_sdr_id).single()
    promises.push(
      supabase.from('leads')
        .update({
          assigned_to: new_sdr_id,
          phase: 'sdr',
          status: 'contacted',
          updated_at: new Date().toISOString(),
        })
        .eq('id', data.lead_id),
      supabase.from('activities').insert({
        lead_id: data.lead_id,
        org_id: data.org_id,
        user_id: actorId,
        activity_type: 'note',
        notes: `SDR reassigned to ${newSdr?.name ?? 'new SDR'} — lead returned to SDR workspace for re-qualification.`,
        new_value: 'sdr_reassigned',
      }),
    )
  }

  // ── Closer Reassignment ───────────────────────────────────────────────────
  // Move the deal to the new closer's pipeline
  if (new_closer_id && data.lead_id) {
    const { data: newCloser } = await supabase.from('users').select('name').eq('id', new_closer_id).single()
    promises.push(
      // Update the deal to point to new closer
      supabase.from('deals')
        .update({
          closer_id: new_closer_id,
          updated_at: new Date().toISOString(),
        })
        .eq('demo_id', params.id),
      supabase.from('activities').insert({
        lead_id: data.lead_id,
        org_id: data.org_id,
        user_id: actorId,
        activity_type: 'note',
        notes: `Closer reassigned to ${newCloser?.name ?? 'new Closer'} — deal moved to their pipeline.`,
        new_value: 'closer_reassigned',
      }),
    )
  }

  await Promise.all(promises)

  return NextResponse.json(data)
}

// DELETE /api/demos/:id — closer deletes a demo; lead returns to SDR pool
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const demoId = params.id
  const authClient = createClient()
  const supabase = createServiceClient()

  // Verify requesting user
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: actorProfile } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .single()
  const actorId = actorProfile?.id ?? ''

  // Fetch demo
  const { data: demo, error: demoFetchErr } = await supabase
    .from('demos')
    .select('id, lead_id, org_id, sdr_id, closer_id')
    .eq('id', demoId)
    .single()

  if (demoFetchErr || !demo) {
    return NextResponse.json({ error: 'Demo not found' }, { status: 404 })
  }

  const now = new Date().toISOString()

  // Soft-delete the demo
  await supabase
    .from('demos')
    .update({ is_deleted: true, deleted_at: now })
    .eq('id', demoId)

  // Soft-delete associated deal (by lead_id)
  await supabase
    .from('deals')
    .update({ is_deleted: true, deleted_at: now })
    .eq('lead_id', demo.lead_id)

  // Return lead to SDR follow-up queue — status=call_again with today as callback_date
  // so it appears in the SDR's Follow-up Queue immediately
  const todayDate = new Date().toISOString().split('T')[0]
  await supabase
    .from('leads')
    .update({
      phase: 'sdr',
      status: 'call_again',
      callback_date: todayDate,
      assigned_to: demo.sdr_id,
      is_deleted: false,
      updated_at: now,
    })
    .eq('id', demo.lead_id)

  // Activity log
  if (actorId) {
    await supabase.from('activities').insert({
      lead_id: demo.lead_id,
      org_id: demo.org_id,
      user_id: actorId,
      activity_type: 'note',
      notes: 'Demo removed by closer — lead returned to your follow-up queue. Follow up to determine next steps.',
    })
  }

  return NextResponse.json({ success: true })
}
