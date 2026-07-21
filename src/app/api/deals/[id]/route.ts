import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { toISTDateString } from '@/lib/utils'
import { notifyRole } from '@/lib/notifications'

// DELETE /api/deals/:id — remove a deal that has NO demo (a manually-added deal).
// Always permanent: soft-deletes the deal + its lead (there is no original SDR to return
// it to). The demo-backed delete path (with permanent/return-to-SDR choice) is /api/demos/[id].
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authClient = createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await authClient.from('users').select('id, role').eq('auth_id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = createServiceClient()
  const { data: deal } = await supabase.from('deals').select('id, lead_id, org_id, closer_id').eq('id', params.id).single()
  if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 })

  // Ownership: the deal's closer, or an admin.
  if ((profile as any).role !== 'admin' && (deal as any).closer_id !== (profile as any).id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const now = new Date().toISOString()
  await supabase.from('deals').update({ is_deleted: true, deleted_at: now }).eq('id', (deal as any).id)
  if ((deal as any).lead_id) {
    await supabase.from('leads').update({ is_deleted: true, deleted_at: now, updated_at: now }).eq('id', (deal as any).lead_id)
    // Defensive: soft-delete any demo tied to the lead (normally none for a demo-less deal).
    await supabase.from('demos').update({ is_deleted: true, deleted_at: now }).eq('lead_id', (deal as any).lead_id)
    await supabase.from('activities').insert({
      lead_id: (deal as any).lead_id,
      org_id: (deal as any).org_id,
      user_id: (profile as any).id,
      activity_type: 'note',
      notes: 'Deal permanently deleted by closer.',
    })
  }
  return NextResponse.json({ success: true })
}

// PATCH /api/deals/:id — update deal stage, follow-up, billing info
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json()
  const { stage, deal_value, plan_type, next_follow_up, loss_reason,
    billing_name, billing_address, gst_number, payment_confirmed, onboarding_issued,
    removed_from_board, proposal_sent_at,
    poc_name, poc_designation, poc_phone, poc_email } = body

  // Validate: loss_reason MANDATORY when stage = lost
  if (stage === 'lost' && !loss_reason) {
    return NextResponse.json({ error: 'Loss reason is mandatory when marking a deal as lost.' }, { status: 400 })
  }

  // Validate: billing_name MANDATORY when stage = won
  if (stage === 'won' && !billing_name) {
    return NextResponse.json({ error: 'Billing name is mandatory when marking a deal as won.' }, { status: 400 })
  }

  // Validate: committed conversion date MANDATORY when stage = converting_later
  if (stage === 'converting_later' && !next_follow_up) {
    return NextResponse.json({ error: 'A committed conversion date is required for Converting Later.' }, { status: 400 })
  }

  const supabase = createClient()

  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (stage) {
    updatePayload.stage = stage
    if (['won', 'lost', 'ghosted', 'unqualified'].includes(stage)) {
      updatePayload.date_won_lost = toISTDateString()  // IST calendar day — closed/terminal date
    }
  }
  if (deal_value !== undefined) updatePayload.deal_value = deal_value
  if (plan_type !== undefined) updatePayload.plan_type = plan_type
  if (next_follow_up !== undefined) updatePayload.next_follow_up = next_follow_up
  if (loss_reason !== undefined) updatePayload.loss_reason = loss_reason
  if (billing_name !== undefined) updatePayload.billing_name = billing_name
  if (billing_address !== undefined) updatePayload.billing_address = billing_address
  if (gst_number !== undefined) updatePayload.gst_number = gst_number
  if (payment_confirmed !== undefined) updatePayload.payment_confirmed = payment_confirmed
  if (onboarding_issued !== undefined) updatePayload.onboarding_issued = onboarding_issued
  if (removed_from_board !== undefined) updatePayload.removed_from_board = removed_from_board
  if (proposal_sent_at !== undefined) updatePayload.proposal_sent_at = proposal_sent_at
  if (poc_name !== undefined) updatePayload.poc_name = poc_name
  if (poc_designation !== undefined) updatePayload.poc_designation = poc_designation
  if (poc_phone !== undefined) updatePayload.poc_phone = poc_phone
  if (poc_email !== undefined) updatePayload.poc_email = poc_email

  const { data, error } = await supabase
    .from('deals')
    .update(updatePayload)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify admins when a deal is won (best-effort — never blocks the stage update).
  if (stage === 'won') {
    const svc = createServiceClient() as any
    const [{ data: closerRow }, { data: orgRow }] = await Promise.all([
      svc.from('users').select('name').eq('id', (data as any).closer_id).single(),
      svc.from('organizations').select('name').eq('id', (data as any).org_id).single(),
    ])
    const value = (data as any).deal_value
    await notifyRole('admin', {
      actorId: (data as any).closer_id,
      type: 'deal_won',
      title: 'Deal won',
      body: `${closerRow?.name ?? 'A closer'} won ${orgRow?.name ?? 'a deal'}${value ? ` — ₹${Number(value).toLocaleString('en-IN')}` : ''}.`,
      link: '/admin',
    })
  }

  return NextResponse.json(data)
}
