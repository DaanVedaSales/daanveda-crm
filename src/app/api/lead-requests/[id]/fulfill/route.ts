import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// POST /api/lead-requests/:id/fulfill — admin enriches a data-enrichment request into a
// real, assigned lead (mirrors /api/leads/manual but admin-driven + assigns to a chosen SDR).
// Creates (or enriches) the org + up to 3 KDMs, creates a lead assigned to the SDR
// (phase=sdr, status=assigned, source_type='sdr_claim'), then marks the request 'fulfilled'.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const authClient = createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: admin } = await authClient.from('users').select('id, role').eq('auth_id', user.id).single()
  if (!admin || admin.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 })
  }

  const body = await req.json()
  const {
    org_name, location, org_url, org_linkedin, thematic_areas,
    kdm_name, kdm_phone, kdm_email, kdm_designation, kdm_linkedin,
    kdm2_name, kdm2_phone, kdm2_email, kdm2_designation, kdm2_linkedin,
    kdm3_name, kdm3_phone, kdm3_email, kdm3_designation, kdm3_linkedin,
    notes, assignee_sdr_id,
  } = body

  if (!org_name?.trim()) return NextResponse.json({ error: 'Organisation name is required' }, { status: 400 })
  if (!kdm_name?.trim()) return NextResponse.json({ error: 'Primary KDM name is required' }, { status: 400 })
  if (!assignee_sdr_id) return NextResponse.json({ error: 'Please choose an SDR to assign to' }, { status: 400 })

  const supabase = createServiceClient()

  // The request must exist + be a pending data_enrichment request
  const { data: request } = await supabase
    .from('lead_assignment_requests').select('id, sdr_id, request_type, status').eq('id', params.id).single()
  if (!request) return NextResponse.json({ error: 'Request not found' }, { status: 404 })

  // Assignee must be an active SDR
  const { data: sdr } = await supabase
    .from('users').select('id').eq('id', assignee_sdr_id).eq('role', 'sdr').eq('is_active', true).single()
  if (!sdr) return NextResponse.json({ error: 'Selected SDR is not available' }, { status: 400 })

  const cleanName = String(org_name).trim().slice(0, 255)
  const kdms = [
    { name: kdm_name,  phone: kdm_phone,  email: kdm_email,  designation: kdm_designation,  linkedin: kdm_linkedin },
    { name: kdm2_name, phone: kdm2_phone, email: kdm2_email, designation: kdm2_designation, linkedin: kdm2_linkedin },
    { name: kdm3_name, phone: kdm3_phone, email: kdm3_email, designation: kdm3_designation, linkedin: kdm3_linkedin },
  ].filter(k => k.name && String(k.name).trim())

  const contactRow = (orgId: string, k: any, isPrimary: boolean) => ({
    org_id: orgId,
    name: String(k.name).trim().slice(0, 255),
    designation: k.designation ? String(k.designation).trim().slice(0, 100) : null,
    phone: k.phone ? String(k.phone).trim().slice(0, 20) : null,
    email: k.email ? String(k.email).trim().slice(0, 255) : null,
    linkedin_url: k.linkedin ? String(k.linkedin).trim().slice(0, 500) : null,
    is_primary: isPrimary,
  })

  // ── Resolve org: reuse an existing one (enrich) or create a new one ────────────
  const { data: existingOrg } = await supabase
    .from('organizations').select('id, is_banned').ilike('name', cleanName).limit(1).maybeSingle()

  if (existingOrg?.is_banned) {
    return NextResponse.json({ error: 'This organisation is banned (do-not-contact) and cannot be assigned.' }, { status: 403 })
  }

  let thematicArr: string[] = []
  if (Array.isArray(thematic_areas)) thematicArr = thematic_areas.filter(Boolean)
  else if (typeof thematic_areas === 'string' && thematic_areas.trim()) {
    thematicArr = thematic_areas.split(',').map((s: string) => s.trim()).filter(Boolean)
  }

  let orgId: string
  if (existingOrg) {
    orgId = existingOrg.id
    // Add KDMs not already present (dedupe by name)
    const { data: existingContacts } = await supabase.from('contacts').select('name').eq('org_id', orgId)
    const have = new Set((existingContacts ?? []).map((c: any) => String(c.name ?? '').trim().toLowerCase()))
    let orgHasNoContacts = (existingContacts ?? []).length === 0
    for (const k of kdms) {
      if (have.has(String(k.name).trim().toLowerCase())) continue
      await supabase.from('contacts').insert(contactRow(orgId, k, orgHasNoContacts))
      orgHasNoContacts = false
    }
  } else {
    const { data: org, error: orgErr } = await supabase
      .from('organizations')
      .insert({
        name: cleanName,
        location: location?.trim() || null,
        url: org_url?.trim() || null,
        linkedin_url: org_linkedin?.trim() || null,
        thematic_areas: thematicArr.length > 0 ? thematicArr : null,
      })
      .select('id').single()
    if (orgErr || !org) return NextResponse.json({ error: orgErr?.message ?? 'Failed to create organisation' }, { status: 500 })
    orgId = org.id
    for (let i = 0; i < kdms.length; i++) {
      await supabase.from('contacts').insert(contactRow(orgId, kdms[i], i === 0))
    }
  }

  // ── Ensure a lead assigned to the chosen SDR (don't duplicate an existing one) ──
  let leadId: string | null = null
  const { data: activeLeads } = await supabase
    .from('leads').select('id, assigned_to').eq('org_id', orgId).eq('is_deleted', false).limit(1)
  if (activeLeads && activeLeads.length > 0) {
    leadId = activeLeads[0].id // org already worked — enriched contacts only, no duplicate lead
  } else {
    const { data: lead, error: leadErr } = await supabase
      .from('leads')
      .insert({ org_id: orgId, status: 'assigned', phase: 'sdr', assigned_to: assignee_sdr_id, assigned_by: admin.id, source_type: 'sdr_claim' })
      .select('id').single()
    if (leadErr || !lead) return NextResponse.json({ error: leadErr?.message ?? 'Failed to create lead' }, { status: 500 })
    leadId = lead.id
    await supabase.from('activities').insert({
      lead_id: leadId,
      org_id: orgId,
      user_id: admin.id,
      activity_type: 'note',
      notes: `Enriched from SDR data-enrichment request and assigned.${notes?.trim() ? ` Note: ${notes.trim()}` : ''}`,
      new_value: 'manual_entry',
    })
  }

  // ── Mark the request fulfilled ─────────────────────────────────────────────────
  // status is free-text on this table; cast around the mis-generated lead_status type.
  await supabase.from('lead_assignment_requests')
    .update({ status: 'fulfilled' as any, reviewed_by: admin.id, reviewed_at: new Date().toISOString() })
    .eq('id', params.id)

  return NextResponse.json({ success: true, lead_id: leadId, org_id: orgId })
}
