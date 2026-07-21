import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { notify } from '@/lib/notifications'

// PATCH /api/lead-requests/[id]
// Admin approves, rejects, or marks fulfilled.
// On lead_pool + approved: auto-creates a lead record assigned to the requesting SDR.

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: adminProfile } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_id', user.id)
    .single()

  if (!adminProfile || adminProfile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 })
  }

  // Fetch the request
  const { data: request, error: fetchErr } = await supabase
    .from('lead_assignment_requests')
    .select('id, request_type, status, org_id, sdr_id')
    .eq('id', params.id)
    .single()

  if (fetchErr || !request) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 })
  }

  // Only pending requests can be actioned
  if (request.status !== 'pending') {
    return NextResponse.json(
      { error: `Request is already ${request.status} and cannot be changed` },
      { status: 409 }
    )
  }

  const body = await req.json()
  const { status, admin_note } = body

  if (!['approved', 'rejected', 'fulfilled'].includes(status)) {
    return NextResponse.json(
      { error: 'status must be approved, rejected, or fulfilled' },
      { status: 400 }
    )
  }

  // ── Auto-create lead on lead_pool + approved ───────────────────────────────
  let autoCreatedLeadId: string | null = null

  if (request.request_type === 'lead_pool' && status === 'approved') {
    if (!request.org_id || !request.sdr_id) {
      return NextResponse.json({ error: 'Request missing org_id or sdr_id — cannot auto-assign' }, { status: 500 })
    }

    // Check if a lead already exists for this org assigned to this SDR
    const { data: existingLead } = await supabase
      .from('leads')
      .select('id')
      .eq('org_id', request.org_id)
      .eq('assigned_to', request.sdr_id)
      .maybeSingle()

    if (existingLead) {
      // Lead already exists — just approve the request (admin oversight)
      autoCreatedLeadId = existingLead.id
    } else {
      // Create a new lead assigned to the SDR — mark as SDR claim for funnel tracking
      const { data: newLead, error: leadErr } = await supabase
        .from('leads')
        .insert({
          org_id: request.org_id,
          status: 'assigned',  // assigned to the claiming SDR — not an unassigned pool lead
          phase: 'sdr',
          assigned_to: request.sdr_id,
          assigned_by: adminProfile.id,
          source_type: 'sdr_claim',
        })
        .select('id')
        .single()

      if (leadErr) {
        return NextResponse.json({ error: `Failed to create lead: ${leadErr.message}` }, { status: 500 })
      }

      autoCreatedLeadId = newLead.id

      // Log an activity on the new lead
      await supabase.from('activities').insert({
        lead_id: newLead.id,
        org_id: request.org_id,
        user_id: adminProfile.id,
        activity_type: 'note',
        notes: `Lead assigned via SDR claim request. Admin approved assignment.`,
        new_value: 'claim_approved',
      })
    }
  }

  // ── Update the request ─────────────────────────────────────────────────────
  const { data: updated, error: updateErr } = await supabase
    .from('lead_assignment_requests')
    .update({
      status,
      admin_note: admin_note?.trim() || null,
      reviewed_by: adminProfile.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .select()
    .single()

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  // Notify the requesting SDR of the decision (best-effort; only for approve/reject).
  if (request.sdr_id && (status === 'approved' || status === 'rejected')) {
    const kind = request.request_type === 'data_enrichment' ? 'Data enrichment request' : 'Lead claim request'
    await notify({
      userId: request.sdr_id, actorId: adminProfile.id, type: 'request_decision',
      title: status === 'approved' ? `${kind} approved` : `${kind} declined`,
      body: status === 'approved'
        ? `Admin approved your request. ${autoCreatedLeadId ? 'The lead is now in My Leads.' : ''}`.trim()
        : `Admin declined your request.${admin_note?.trim() ? ` Note: ${admin_note.trim()}` : ''}`,
      link: '/sdr/leads',
    })
  }

  return NextResponse.json({
    request: updated,
    auto_created_lead_id: autoCreatedLeadId,
  })
}
