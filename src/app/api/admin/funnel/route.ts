import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { toISTDateString, istDayStart, istDayEnd, istWeekStart } from '@/lib/utils'

// GET /api/admin/funnel?period=today|week|month|all&start=YYYY-MM-DD&end=YYYY-MM-DD
// Returns lead funnel stage counts for the admin dashboard.
// Respects the same period filter as /api/team/stats.
// Admin-only.
export async function GET(request: Request) {
  const authClient = createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: callerProfile } = await authClient
    .from('users')
    .select('role')
    .eq('auth_id', user.id)
    .single()

  if (!callerProfile || callerProfile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 })
  }

  const supabase = createServiceClient()
  const { searchParams } = new URL(request.url)
  const period = searchParams.get('period') ?? 'month'
  const customStart = searchParams.get('start')
  const customEnd = searchParams.get('end')

  // Build date range — in IST (business timezone); server runs UTC.
  // Mirrors /api/team/stats exactly so the funnel and stats agree on the same dashboard.
  const nowIso = new Date().toISOString()   // real current instant (end-of-range "now")
  const istToday = toISTDateString()        // 'YYYY-MM-DD' in IST
  let rangeStart: string | null = null
  let rangeEnd: string | null = null

  if (period === 'custom' && customStart && customEnd) {
    rangeStart = istDayStart(customStart)
    rangeEnd = istDayEnd(customEnd)
  } else if (period === 'today') {
    rangeStart = istDayStart(istToday)
    rangeEnd = istDayEnd(istToday)
  } else if (period === 'week') {
    rangeStart = istDayStart(istWeekStart())
    rangeEnd = nowIso
  } else if (period === 'month') {
    rangeStart = istDayStart(`${istToday.slice(0, 7)}-01`)
    rangeEnd = nowIso
  }
  // period === 'all' → no date filter

  // Helper: apply date range to a query
  function applyRange<T extends { gte: (col: string, val: string) => T; lte: (col: string, val: string) => T }>(
    query: T,
    column: string
  ): T {
    if (rangeStart) query = query.gte(column, rangeStart)
    if (rangeEnd)   query = query.lte(column, rangeEnd)
    return query
  }

  // Run all funnel queries in parallel
  const [
    leadsTotal,
    leadsAdminPool,
    leadsSdrManual,
    leadsSdrClaim,
    demosBooked,
    demosAttended,
    dealsWon,
    dealsLostGhosted,
  ] = await Promise.all([
    // Stage 1: Total leads assigned in period
    applyRange(
      supabase.from('leads').select('id', { count: 'exact', head: true }).not('assigned_to', 'is', null),
      'created_at'
    ),
    // Stage 1 by source: admin_pool (default — from dataset uploads)
    // Scoped to assigned leads so the source breakdown reconciles with `total`.
    applyRange(
      supabase.from('leads').select('id', { count: 'exact', head: true }).not('assigned_to', 'is', null).eq('source_type', 'admin_pool'),
      'created_at'
    ),
    // Stage 1 by source: sdr_manual (SDR added via /leads/manual)
    applyRange(
      supabase.from('leads').select('id', { count: 'exact', head: true }).not('assigned_to', 'is', null).eq('source_type', 'sdr_manual'),
      'created_at'
    ),
    // Stage 1 by source: sdr_claim (SDR claimed from lead pool, admin approved)
    applyRange(
      supabase.from('leads').select('id', { count: 'exact', head: true }).not('assigned_to', 'is', null).eq('source_type', 'sdr_claim'),
      'created_at'
    ),
    // Stage 2: Demos booked in period
    applyRange(
      supabase.from('demos').select('id', { count: 'exact', head: true }).eq('is_deleted', false),
      'created_at'
    ),
    // Stage 3: Demos attended (by demo_date in period)
    applyRange(
      supabase.from('demos').select('id', { count: 'exact', head: true }).eq('status', 'attended'),
      'demo_date'
    ),
    // Stage 4: Deals won in period
    applyRange(
      supabase.from('deals').select('id', { count: 'exact', head: true }).in('stage', ['won', 'converted']),
      'date_won_lost'
    ),
    // Stage 5: Lost + ghosted in period
    applyRange(
      supabase.from('deals').select('id', { count: 'exact', head: true }).in('stage', ['lost', 'ghosted']),
      'updated_at'
    ),
  ])

  return NextResponse.json({
    period,
    range_start: rangeStart,
    range_end: rangeEnd,
    leads_assigned: {
      total:      leadsTotal.count       ?? 0,
      admin_pool: leadsAdminPool.count   ?? 0,
      sdr_manual: leadsSdrManual.count   ?? 0,
      sdr_claim:  leadsSdrClaim.count    ?? 0,
    },
    demos_booked:       demosBooked.count       ?? 0,
    demos_attended:     demosAttended.count      ?? 0,
    deals_won:          dealsWon.count           ?? 0,
    deals_lost_ghosted: dealsLostGhosted.count   ?? 0,
  })
}
