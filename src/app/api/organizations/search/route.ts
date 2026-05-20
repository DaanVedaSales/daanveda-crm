import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET /api/organizations/search?q=query&limit=8
// Fuzzy search across all orgs using pg_trgm + ILIKE fallback
// Returns each org with a derived status and assignee info
// Accessible to all authenticated roles (sdr, closer, admin)

export type OrgSearchStatus =
  | 'active_client'
  | 'lost'
  | 'ghosted'
  | 'in_pipeline'
  | 'demo_booked'
  | 'with_sdr'
  | 'claim_pending'
  | 'in_lead_pool'
  | 'in_database'

export interface OrgSearchResult {
  id: string
  name: string
  location: string | null
  thematic_areas: string[] | null
  is_client: boolean
  status: OrgSearchStatus
  status_label: string
  assignee_name: string | null
  assignee_role: 'sdr' | 'closer' | null
  deal_stage: string | null
  similarity: number
  is_exact_match: boolean
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q      = searchParams.get('q')?.trim() ?? ''
  const limit  = Math.min(parseInt(searchParams.get('limit') ?? '8'), 20)

  if (!q || q.length < 2) {
    return NextResponse.json([])
  }

  const authClient = createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify authenticated
  const { data: profile } = await authClient
    .from('users')
    .select('id, role')
    .eq('auth_id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Use service client for org search so status derivation is role-agnostic —
  // every viewer (SDR, Closer, Admin) sees the true pipeline status of each org
  const supabase = createServiceClient()

  // ── 1. Fetch candidate orgs via pg_trgm similarity + ILIKE fallback ──────
  const searchLower = q.toLowerCase()

  const { data: orgs, error } = await supabase
    .from('organizations')
    .select(`
      id, name, location, thematic_areas, is_client,
      leads(
        id, phase, status, assigned_to,
        assigned_user:users!leads_assigned_to_fkey(id, name, role),
        demos(
          id, status, demo_date,
          closer:users!demos_closer_id_fkey(id, name)
        ),
        deals(
          id, stage,
          closer:users!deals_closer_id_fkey(id, name)
        )
      )
    `)
    .or(`name.ilike.%${q}%,name.ilike.${q}%`)
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let allOrgs = orgs ?? []

  if (allOrgs.length < limit) {
    const tokens = q.split(/\s+/).filter(t => t.length >= 3)
    if (tokens.length > 0) {
      const tokenResults = await Promise.all(
        tokens.map(token =>
          supabase
            .from('organizations')
            .select(`
              id, name, location, thematic_areas, is_client,
              leads(
                id, phase, status, assigned_to,
                assigned_user:users!leads_assigned_to_fkey(id, name, role),
                demos(
                  id, status, demo_date,
                  closer:users!demos_closer_id_fkey(id, name)
                ),
                deals(
                  id, stage,
                  closer:users!deals_closer_id_fkey(id, name)
                )
              )
            `)
            .ilike('name', `%${token}%`)
            .limit(20)
        )
      )
      const existing = new Set(allOrgs.map((o: any) => o.id))
      tokenResults.forEach(r => {
        if (r.data) {
          r.data.forEach((org: any) => {
            if (!existing.has(org.id)) {
              allOrgs.push(org)
              existing.add(org.id)
            }
          })
        }
      })
    }
  }

  // ── 2. Fetch pending lead_pool claims for these orgs ─────────────────────
  // Builds a map: org_id → claiming SDR's name
  // Used to show "Claimed · Pending" status instead of in_lead_pool / in_database
  const orgIds = allOrgs.map((o: any) => o.id).filter(Boolean)
  const claimMap: Record<string, string> = {}

  if (orgIds.length > 0) {
    const { data: pendingClaims } = await supabase
      .from('lead_assignment_requests')
      .select('org_id, sdr:users!lead_assignment_requests_sdr_id_fkey(name)')
      .in('org_id', orgIds)
      .eq('status', 'pending')
      .eq('request_type', 'lead_pool')

    ;(pendingClaims ?? []).forEach((c: any) => {
      if (c.org_id && c.sdr?.name && !claimMap[c.org_id]) {
        // Keep first claimer if multiple (shouldn't happen due to duplicate check)
        claimMap[c.org_id] = c.sdr.name
      }
    })
  }

  // ── 3. Score and derive status for each org ───────────────────────────────
  const scored: OrgSearchResult[] = allOrgs.map((org: any) => {
    const nameLower = org.name.toLowerCase()
    const sim = jsSimilarity(searchLower, nameLower)
    const isExact = nameLower === searchLower || nameLower.startsWith(searchLower)

    const status = deriveStatus(org, claimMap[org.id] ?? null)

    return {
      id: org.id,
      name: org.name,
      location: org.location,
      thematic_areas: org.thematic_areas,
      is_client: org.is_client ?? false,
      ...status,
      similarity: sim,
      is_exact_match: isExact,
    }
  })

  // ── 4. Sort: exact matches first, then by similarity score ────────────────
  scored.sort((a, b) => {
    if (a.is_exact_match !== b.is_exact_match) return a.is_exact_match ? -1 : 1
    return b.similarity - a.similarity
  })

  return NextResponse.json(scored.slice(0, limit))
}

// ── Status derivation (priority order) ───────────────────────────────────────
// claimingSDRName: if a pending lead_pool claim exists for this org, the SDR's name
function deriveStatus(org: any, claimingSDRName: string | null): {
  status: OrgSearchStatus
  status_label: string
  assignee_name: string | null
  assignee_role: 'sdr' | 'closer' | null
  deal_stage: string | null
} {
  const leads: any[] = org.leads ?? []

  if (org.is_client) {
    return { status: 'active_client', status_label: 'Active client', assignee_name: null, assignee_role: null, deal_stage: null }
  }

  const allDeals = leads.flatMap((l: any) => l.deals ?? [])
  const allDemos = leads.flatMap((l: any) => l.demos ?? [])

  // Won deal → active client
  const wonDeal = allDeals.find((d: any) => d.stage === 'won')
  if (wonDeal) {
    return { status: 'active_client', status_label: 'Active client', assignee_name: wonDeal.closer?.name ?? null, assignee_role: 'closer', deal_stage: 'won' }
  }

  // Active pipeline deal (non-terminal)
  const TERMINAL = ['won', 'lost', 'ghosted', 'unqualified']
  const activeDeal = allDeals.find((d: any) => !TERMINAL.includes(d.stage))
  if (activeDeal) {
    const stageLabel = STAGE_LABELS[activeDeal.stage as string] ?? activeDeal.stage
    return {
      status: 'in_pipeline',
      status_label: `In pipeline · ${stageLabel}`,
      assignee_name: activeDeal.closer?.name ?? null,
      assignee_role: 'closer',
      deal_stage: activeDeal.stage,
    }
  }

  // Lost / ghosted deal
  const lostDeal = allDeals.find((d: any) => d.stage === 'lost')
  if (lostDeal) {
    return { status: 'lost', status_label: 'Previously lost', assignee_name: lostDeal.closer?.name ?? null, assignee_role: 'closer', deal_stage: 'lost' }
  }
  const ghostedDeal = allDeals.find((d: any) => ['ghosted', 'unqualified'].includes(d.stage))
  if (ghostedDeal) {
    return { status: 'ghosted', status_label: 'Previously ghosted', assignee_name: null, assignee_role: null, deal_stage: ghostedDeal.stage }
  }

  // Demo booked (scheduled or rescheduled)
  const demo = allDemos.find((d: any) => ['scheduled', 'rescheduled'].includes(d.status))
  if (demo) {
    return {
      status: 'demo_booked',
      status_label: 'Demo booked',
      assignee_name: demo.closer?.name ?? null,
      assignee_role: 'closer',
      deal_stage: null,
    }
  }

  // Lead assigned to an SDR
  const assignedLead = leads.find((l: any) => l.assigned_to && l.phase === 'sdr')
  if (assignedLead) {
    return {
      status: 'with_sdr',
      status_label: 'With SDR',
      assignee_name: assignedLead.assigned_user?.name ?? null,
      assignee_role: 'sdr',
      deal_stage: null,
    }
  }

  // ── Pending claim check (before in_lead_pool / in_database) ──────────────
  // If an SDR has claimed this org and it's awaiting admin approval, surface that.
  if (claimingSDRName) {
    return {
      status: 'claim_pending',
      status_label: `Claimed · Pending`,
      assignee_name: claimingSDRName,
      assignee_role: 'sdr',
      deal_stage: null,
    }
  }

  // Lead exists but unassigned (in lead pool)
  const poolLead = leads.find((l: any) => !l.assigned_to && l.phase === 'sdr')
  if (poolLead) {
    return { status: 'in_lead_pool', status_label: 'In lead pool · unassigned', assignee_name: null, assignee_role: null, deal_stage: null }
  }

  // Org exists in database but no active lead
  return { status: 'in_database', status_label: 'In database', assignee_name: null, assignee_role: null, deal_stage: null }
}

// ── JS trigram similarity approximation ──────────────────────────────────────
function trigrams(s: string): Set<string> {
  const padded = `  ${s}  `
  const tgrams = new Set<string>()
  for (let i = 0; i < padded.length - 2; i++) {
    tgrams.add(padded.slice(i, i + 3))
  }
  return tgrams
}

function jsSimilarity(a: string, b: string): number {
  if (a === b) return 1
  if (a.length < 1 || b.length < 1) return 0
  const ta = trigrams(a)
  const tb = trigrams(b)
  let intersection = 0
  ta.forEach(t => { if (tb.has(t)) intersection++ })
  return (2 * intersection) / (ta.size + tb.size)
}

const STAGE_LABELS: Record<string, string> = {
  demo_done:   'Demo done',
  follow_up:   'Follow-up',
  proposal:    'Proposal',
  negotiation: 'Negotiation',
  won:         'Won',
  lost:        'Lost',
  ghosted:     'Ghosted',
  unqualified: 'Unqualified',
}
