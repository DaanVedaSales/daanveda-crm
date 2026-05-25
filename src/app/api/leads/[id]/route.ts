import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET /api/leads/:id — single lead + timeline + contacts
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()

  const [leadRes, activitiesRes, contactsRes] = await Promise.all([
    supabase
      .from('leads')
      .select('*, organization:organizations(*)')
      .eq('id', params.id)
      .single(),
    supabase
      .from('activities')
      .select('*, user:users(id, name, role)')
      .eq('lead_id', params.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('contacts')
      .select('*')
      .eq('org_id', (await supabase.from('leads').select('org_id').eq('id', params.id).single()).data?.org_id ?? '')
      .order('is_primary', { ascending: false }),
  ])

  if (leadRes.error) return NextResponse.json({ error: leadRes.error.message }, { status: 404 })

  return NextResponse.json({
    lead: leadRes.data,
    activities: activitiesRes.data ?? [],
    contacts: contactsRes.data ?? [],
  })
}

// DELETE /api/leads/:id — soft-delete lead (cascades to demos + deals)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const leadId = params.id
  const supabase = createServiceClient()

  // Verify lead exists
  const { data: lead, error: leadFetchErr } = await supabase
    .from('leads')
    .select('id, org_id')
    .eq('id', leadId)
    .single()

  if (leadFetchErr || !lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  }

  const now = new Date().toISOString()

  // Soft-delete the lead
  const { error: leadDelErr } = await supabase
    .from('leads')
    .update({ is_deleted: true, deleted_at: now })
    .eq('id', leadId)

  if (leadDelErr) return NextResponse.json({ error: leadDelErr.message }, { status: 500 })

  // Cascade soft-delete demos for this lead
  await supabase
    .from('demos')
    .update({ is_deleted: true, deleted_at: now })
    .eq('lead_id', leadId)

  // Cascade soft-delete deals for this lead
  await supabase
    .from('deals')
    .update({ is_deleted: true, deleted_at: now })
    .eq('lead_id', leadId)

  // Get requesting user for activity log
  const authClient = createClient()
  const { data: { user } } = await authClient.auth.getUser()
  let actorId: string | null = null
  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single()
    actorId = profile?.id ?? null
  }

  if (actorId) {
    await supabase.from('activities').insert({
      lead_id: leadId,
      org_id: lead.org_id,
      user_id: actorId,
      activity_type: 'note',
      notes: 'Lead deleted.',
    })
  }

  return NextResponse.json({ success: true })
}

// PATCH /api/leads/:id — update lead
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json()
  const supabase = createClient()

  // SDR cannot update phase=closer leads
  const { data: existing } = await supabase
    .from('leads')
    .select('phase, assigned_to')
    .eq('id', params.id)
    .single()

  if (existing?.phase === 'closer' && body.status) {
    return NextResponse.json({ error: 'Cannot update a lead in closer phase' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('leads')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
