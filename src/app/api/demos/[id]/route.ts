import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { toISTDateString, IST_TIMEZONE } from '@/lib/utils'
import { notify } from '@/lib/notifications'

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

  // Pre-fetch current demo state — needed to detect "reschedule from no_show" restoration
  const { data: currentDemo } = await supabase
    .from('demos')
    .select('status, lead_id, org_id, sdr_id, closer_id')
    .eq('id', params.id)
    .single()

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
  // Lead completely leaves closer's workspace and returns to original SDR's follow-up queue
  if (status === 'no_show') {
    const serviceSupabase = createServiceClient()
    const nowIso = new Date().toISOString()   // UTC instant for updated_at
    const todayDate = toISTDateString()       // IST calendar day for callback_date

    // Fetch SDR name for activity note
    const { data: sdrUser } = await supabase
      .from('users').select('name').eq('id', data.sdr_id).single()

    if (data.lead_id && data.sdr_id) {
      promises.push(
        // Return lead to original SDR's follow-up queue with no_show status
        serviceSupabase.from('leads').update({
          phase: 'sdr',
          status: 'no_show',
          callback_date: todayDate,
          assigned_to: data.sdr_id,
          updated_at: nowIso,
        }).eq('id', data.lead_id) as unknown as Promise<unknown>,

        // Hide deal from closer's Kanban (removed_from_board = true)
        serviceSupabase.from('deals').update({
          removed_from_board: true,
          updated_at: nowIso,
        }).eq('demo_id', params.id) as unknown as Promise<unknown>,
      )
    }

    promises.push(
      supabase.from('activities').insert({
        lead_id: data.lead_id,
        org_id: data.org_id,
        user_id: actorId,
        activity_type: 'note',
        notes: `Demo no-show — org did not attend. Lead returned to SDR${sdrUser?.name ? ` ${sdrUser.name}` : ''} for rescheduling.`,
        new_value: 'demo_no_show',
      }),
    )
  }

  // ── Reschedule ────────────────────────────────────────────────────────────
  if (reschedule_date) {
    const rescheduledTo = new Date(reschedule_date).toLocaleString('en-IN', {
      timeZone: IST_TIMEZONE,
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    })
    promises.push(
      supabase.from('activities').insert({
        lead_id: data.lead_id,
        org_id: data.org_id,
        user_id: actorId,
        activity_type: 'note',
        notes: `Demo rescheduled to ${rescheduledTo}.${new_sdr_id ? ` SDR reassigned.` : ''}${new_closer_id ? ` Closer reassigned.` : ''}${currentDemo?.status === 'no_show' ? ' Lead returned to closer workspace.' : ''}`,
        new_value: 'demo_rescheduled',
      }),
    )

    // ── Restore from no_show: SDR rescheduled a no-show demo ─────────────────
    // Return the lead to closer's workspace and restore the deal in the Kanban
    if (currentDemo?.status === 'no_show' && currentDemo.lead_id) {
      const serviceSupabase = createServiceClient()
      const nowIso = new Date().toISOString()
      const finalCloserId = new_closer_id || currentDemo.closer_id

      promises.push(
        // Return lead to closer workspace
        serviceSupabase.from('leads').update({
          phase: 'closer',
          status: 'demo_booked',
          assigned_to: finalCloserId,
          callback_date: null,
          updated_at: nowIso,
        }).eq('id', currentDemo.lead_id) as unknown as Promise<unknown>,

        // Restore deal to Kanban with correct closer
        serviceSupabase.from('deals').update({
          removed_from_board: false,
          stage: 'demo_scheduled',
          closer_id: finalCloserId,
          updated_at: nowIso,
        }).eq('demo_id', params.id) as unknown as Promise<unknown>,
      )
    }
  }

  // ── SDR Reassignment — CREDIT ONLY ────────────────────────────────────────
  // demos.sdr_id is re-pointed in updatePayload above, so the new SDR gets the credit
  // (dashboards attribute demos by sdr_id). The lead STAYS with the closer — it is NOT
  // sent back to the SDR workspace. Only a note is logged here.
  if (new_sdr_id && data.lead_id) {
    const { data: newSdr } = await supabase.from('users').select('name').eq('id', new_sdr_id).single()
    promises.push(
      supabase.from('activities').insert({
        lead_id: data.lead_id,
        org_id: data.org_id,
        user_id: actorId,
        activity_type: 'note',
        notes: `SDR credit reassigned to ${newSdr?.name ?? 'new SDR'}. Deal stays with the closer.`,
        new_value: 'sdr_reassigned',
      }),
    )
  }

  // ── Closer Reassignment — LEAD MOVES ──────────────────────────────────────
  // The demo (demos.closer_id in updatePayload above), the deal, AND the lead ownership
  // all move to the new closer's workspace. SDR credit is untouched.
  if (new_closer_id && data.lead_id) {
    const { data: newCloser } = await supabase.from('users').select('name').eq('id', new_closer_id).single()
    const nowIso = new Date().toISOString()
    promises.push(
      // Move the deal to the new closer's pipeline
      supabase.from('deals')
        .update({ closer_id: new_closer_id, updated_at: nowIso })
        .eq('demo_id', params.id),
      // Move the lead ownership too (a closer-phase lead is assigned to its closer)
      supabase.from('leads')
        .update({ assigned_to: new_closer_id, updated_at: nowIso })
        .eq('id', data.lead_id),
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

  // ── Notifications (best-effort — never block the demo update) ───────────────
  // Core work above already succeeded. data.sdr_id/closer_id reflect any reassignment.
  {
    const { data: nOrg } = await supabase.from('organizations').select('name').eq('id', data.org_id).single()
    const orgName = nOrg?.name ?? 'a lead'
    const shortDate = (iso: string) => new Date(iso).toLocaleString('en-IN', {
      timeZone: IST_TIMEZONE, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
    })

    if (status === 'no_show' && data.sdr_id) {
      await notify({
        userId: data.sdr_id, actorId: actorId, type: 'demo_no_show',
        title: 'Demo no-show — back to you',
        body: `The demo with ${orgName} was a no-show. The lead is back in your follow-ups to reschedule.`,
        link: '/sdr/followups',
      })
    } else if (new_closer_id) {
      // Closer reassignment — notify the closer who now owns the demo.
      await notify({
        userId: new_closer_id, actorId: actorId, type: 'demo_reassigned',
        title: 'A demo was assigned to you',
        body: `The demo with ${orgName} was moved to your pipeline${reschedule_date ? `, rescheduled to ${shortDate(reschedule_date)}` : ''}.`,
        link: '/closer/today',
      })
    } else if (reschedule_date) {
      // Plain reschedule — notify the counterpart (whoever didn't perform it).
      const recipient = actorId === data.sdr_id ? data.closer_id : data.sdr_id
      const toCloser = recipient === data.closer_id
      await notify({
        userId: recipient, actorId: actorId, type: 'demo_rescheduled',
        title: 'Demo rescheduled',
        body: `The demo with ${orgName} was rescheduled to ${shortDate(reschedule_date)}.`,
        link: toCloser ? '/closer/today' : '/sdr/demos',
      })
    }
  }

  return NextResponse.json(data)
}

// DELETE /api/demos/:id — closer deletes a demo; lead returns to SDR pool
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const demoId = params.id
  // 'permanent' → remove the lead entirely (appears nowhere). 'return_to_sdr' (default) →
  // send the lead back to the original SDR's follow-up queue, flagged as returned by closer.
  const mode = new URL(req.url).searchParams.get('mode') === 'permanent' ? 'permanent' : 'return_to_sdr'
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

  if (mode === 'permanent') {
    // Permanent: soft-delete the lead too — it appears nowhere for anyone.
    if (demo.lead_id) {
      await supabase
        .from('leads')
        .update({ is_deleted: true, deleted_at: now, updated_at: now })
        .eq('id', demo.lead_id)
    }
    if (actorId && demo.lead_id) {
      await supabase.from('activities').insert({
        lead_id: demo.lead_id,
        org_id: demo.org_id,
        user_id: actorId,
        activity_type: 'note',
        notes: 'Deal permanently deleted by closer.',
      })
    }
  } else {
    // Return lead to the original SDR's follow-up queue (call_again, today), flagged as
    // returned-by-closer so the SDR sees a red label. The SDR can then delete it themselves.
    const todayDate = toISTDateString()
    await supabase
      .from('leads')
      .update({
        phase: 'sdr',
        status: 'call_again',
        callback_date: todayDate,
        assigned_to: demo.sdr_id,
        recycle_reason: 'Returned by closer — deal deleted',
        is_deleted: false,
        updated_at: now,
      })
      .eq('id', demo.lead_id)

    if (actorId && demo.lead_id) {
      await supabase.from('activities').insert({
        lead_id: demo.lead_id,
        org_id: demo.org_id,
        user_id: actorId,
        activity_type: 'note',
        notes: 'Deal deleted by closer — lead returned to SDR follow-up queue.',
      })
    }

    // Notify the original SDR the lead is back with them (best-effort).
    if (demo.sdr_id) {
      const { data: rOrg } = await supabase.from('organizations').select('name').eq('id', demo.org_id).single()
      await notify({
        userId: demo.sdr_id, actorId: actorId, type: 'lead_returned',
        title: 'A lead was returned to you',
        body: `The closer returned ${rOrg?.name ?? 'a lead'} — it's back in your follow-ups.`,
        link: '/sdr/followups',
      })
    }
  }

  return NextResponse.json({ success: true })
}
