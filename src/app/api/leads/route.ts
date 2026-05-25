import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/leads — filtered list
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const phase = searchParams.get('phase')
  const assignedTo = searchParams.get('assigned_to')
  const status = searchParams.get('status')
  const datasetId = searchParams.get('dataset_id')

  const supabase = createClient()

  // Validate enum values to prevent unexpected filter injection
  const VALID_PHASES = ['sdr', 'closer', 'won', 'lost']
  const VALID_STATUSES = ['new', 'assigned', 'contacted', 'call_again', 'hot', 'demo_booked', 'won', 'lost', 'not_interested', 'not_reachable', 'recycled', 'dnc']
  if (phase && !VALID_PHASES.includes(phase)) {
    return NextResponse.json({ error: 'Invalid phase value' }, { status: 400 })
  }
  if (status && !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Invalid status value' }, { status: 400 })
  }

  let query = supabase
    .from('leads')
    .select(`
      *,
      organization:organizations(*),
      assignee:users!leads_assigned_to_fkey(id, name, role)
    `)
    .order('updated_at', { ascending: false })

  query = query.eq('is_deleted', false)
  if (phase) query = query.eq('phase', phase)
  if (assignedTo) query = query.eq('assigned_to', assignedTo)
  if (status) query = query.eq('status', status)
  if (datasetId) query = query.eq('dataset_id', datasetId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/leads — create lead (admin only, manual entry)
export async function POST(req: NextRequest) {
  const supabase = createClient()

  // Auth + role check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('auth_id', user.id).single()
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 })
  }

  const body = await req.json()

  // Whitelist allowed fields — never pass raw body to insert
  const { org_id, dataset_id, status, phase, assigned_to, notes } = body

  if (!org_id) {
    return NextResponse.json({ error: 'org_id is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('leads')
    .insert({
      org_id,
      dataset_id: dataset_id ?? null,
      status: status ?? 'new',
      phase: phase ?? 'sdr',
      assigned_to: assigned_to ?? null,
      notes: notes ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
