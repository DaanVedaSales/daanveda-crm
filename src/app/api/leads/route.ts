import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/paginate'

// GET /api/leads — filtered list
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const phase = searchParams.get('phase')
  const assignedTo = searchParams.get('assigned_to')
  const status = searchParams.get('status')
  const datasetId = searchParams.get('dataset_id')
  const enrich = searchParams.get('enrich') === '1'

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

  // Fetch ALL matching leads (paging past the ~1000-row PostgREST cap) so the
  // admin pool / any unfiltered consumer never silently truncates.
  let data: any[]
  try {
    data = await fetchAllRows((from, to) => {
      let q = supabase
        .from('leads')
        .select(`
          *,
          organization:organizations(*),
          assignee:users!leads_assigned_to_fkey(id, name, role)
        `)
        .eq('is_deleted', false)
      if (phase) q = q.eq('phase', phase)
      if (assignedTo) q = q.eq('assigned_to', assignedTo)
      if (status) q = q.eq('status', status)
      if (datasetId) q = q.eq('dataset_id', datasetId)
      // Stable order with an id tiebreaker so pages don't overlap/skip.
      return q.order('updated_at', { ascending: false }).order('id', { ascending: true }).range(from, to)
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
  // Hide leads belonging to banned organisations (do-not-contact)
  const leads = data.filter((l: any) => !l.organization?.is_banned)

  // Without ?enrich=1 the response is unchanged (e.g. the admin Lead Pool). With it,
  // attach the primary contact + last activity (+ last comment) to each lead SERVER-SIDE,
  // so the SDR My Leads list loads in ONE request instead of the browser firing separate
  // contacts/activities/comments queries (which could stall on the browser connection at
  // high lead counts). Enrichment is best-effort: a failure returns leads un-enriched.
  if (!enrich || leads.length === 0) {
    return NextResponse.json(leads)
  }

  const orgIds = Array.from(new Set(leads.map((l: any) => l.org_id).filter(Boolean)))
  const leadIds = leads.map((l: any) => l.id).filter(Boolean)
  const contactMap: Record<string, { name: string | null; phone: string | null }> = {}
  const actMap: Record<string, { channels: string[]; outcome: string | null; at: string }> = {}
  const commentMap: Record<string, string> = {}

  try {
    const [contactRows, actRows, cmtRows] = await Promise.all([
      orgIds.length
        ? fetchAllRows((from, to) => supabase.from('contacts').select('org_id, name, phone').in('org_id', orgIds as string[]).eq('is_primary', true).order('id', { ascending: true }).range(from, to))
        : Promise.resolve([] as any[]),
      leadIds.length
        ? fetchAllRows((from, to) => supabase.from('activities').select('lead_id, channel, outcome, created_at').in('lead_id', leadIds).order('created_at', { ascending: false }).order('id', { ascending: true }).range(from, to))
        : Promise.resolve([] as any[]),
      leadIds.length
        ? fetchAllRows((from, to) => supabase.from('lead_comments').select('lead_id, comment, created_at').in('lead_id', leadIds).order('created_at', { ascending: false }).order('id', { ascending: true }).range(from, to))
        : Promise.resolve([] as any[]),
    ])
    ;(contactRows as any[]).forEach((c: any) => { if (!contactMap[c.org_id]) contactMap[c.org_id] = { name: c.name, phone: c.phone } })
    ;(actRows as any[]).forEach((a: any) => {
      if (!actMap[a.lead_id]) actMap[a.lead_id] = { channels: [], outcome: a.outcome ?? null, at: a.created_at }
      if (a.channel && !actMap[a.lead_id].channels.includes(a.channel)) actMap[a.lead_id].channels.push(a.channel)
    })
    ;(cmtRows as any[]).forEach((c: any) => { if (!commentMap[c.lead_id]) commentMap[c.lead_id] = c.comment })
  } catch {
    // best-effort — return whatever enrichment we have (possibly none) rather than failing
  }

  const enriched = leads.map((l: any) => ({
    ...l,
    primaryContact: contactMap[l.org_id] ?? null,
    lastActivity: actMap[l.id] ?? null,
    lastComment: commentMap[l.id] ?? null,
  }))
  return NextResponse.json(enriched)
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
