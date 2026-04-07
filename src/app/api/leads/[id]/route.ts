import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
