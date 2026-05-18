import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/lead-requests  — SDR submits a claim request
// GET  /api/lead-requests  — Admin fetches all claims (with filters)

// ─── POST ────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_id', user.id)
    .single()

  if (!profile || !['sdr', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden: SDR access required' }, { status: 403 })
  }

  const body = await req.json()
  const { request_type, org_id, org_name_requested, sdr_notes } = body

  // Validate request_type
  if (!['lead_pool', 'data_enrichment'].includes(request_type)) {
    return NextResponse.json({ error: 'request_type must be lead_pool or data_enrichment' }, { status: 400 })
  }

  // Type-specific validation
  if (request_type === 'lead_pool') {
    if (!org_id) {
      return NextResponse.json({ error: 'org_id is required for lead_pool requests' }, { status: 400 })
    }
    // Verify org exists and has unassigned leads in pool
    const { data: org } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('id', org_id)
      .single()

    if (!org) {
      return NextResponse.json({ error: 'Organisation not found' }, { status: 404 })
    }

    // Check for existing pending request from this SDR for the same org
    const { data: existing } = await supabase
      .from('lead_assignment_requests')
      .select('id')
      .eq('sdr_id', profile.id)
      .eq('org_id', org_id)
      .eq('status', 'pending')
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'You already have a pending request for this organisation' }, { status: 409 })
    }
  }

  if (request_type === 'data_enrichment') {
    if (!org_name_requested?.trim()) {
      return NextResponse.json({ error: 'org_name_requested is required for data_enrichment requests' }, { status: 400 })
    }
  }

  // Insert the request
  const { data: request, error } = await supabase
    .from('lead_assignment_requests')
    .insert({
      request_type,
      org_id: request_type === 'lead_pool' ? org_id : null,
      org_name_requested: request_type === 'data_enrichment' ? org_name_requested.trim() : null,
      sdr_id: profile.id,
      sdr_notes: sdr_notes?.trim() || null,
      status: 'pending',
    })
    .select()
    .single()

  if (error) {
    // Unique constraint violation (race condition duplicate)
    if (error.code === '23505') {
      return NextResponse.json({ error: 'You already have a pending request for this organisation' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(request, { status: 201 })
}

// ─── GET ─────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const typeFilter   = searchParams.get('type')   // 'lead_pool' | 'data_enrichment' | null
  const statusFilter = searchParams.get('status') // 'pending' | 'approved' | 'rejected' | 'fulfilled' | null

  let query = supabase
    .from('lead_assignment_requests')
    .select(`
      id,
      request_type,
      status,
      sdr_notes,
      admin_note,
      requested_at,
      reviewed_at,
      org_id,
      org_name_requested,
      org:organizations!lead_assignment_requests_org_id_fkey(id, name, location, thematic_areas),
      sdr:users!lead_assignment_requests_sdr_id_fkey(id, name, role),
      reviewer:users!lead_assignment_requests_reviewed_by_fkey(id, name)
    `)
    .order('requested_at', { ascending: false })

  if (typeFilter && ['lead_pool', 'data_enrichment'].includes(typeFilter)) {
    query = query.eq('request_type', typeFilter)
  }
  if (statusFilter && ['pending', 'approved', 'rejected', 'fulfilled'].includes(statusFilter)) {
    query = query.eq('status', statusFilter)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data ?? [])
}
