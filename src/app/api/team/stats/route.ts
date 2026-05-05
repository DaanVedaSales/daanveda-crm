import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET /api/team/stats?period=today|week|month|all&start=YYYY-MM-DD&end=YYYY-MM-DD
// Returns rich per-person stats for SDRs and Closers. Admin-only.
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

  const { searchParams } = new URL(request.url)
  const period = searchParams.get('period') ?? 'month'
  const customStart = searchParams.get('start')
  const customEnd = searchParams.get('end')

  // Compute date range bounds
  const now = new Date()
  let rangeStart: string | null = null
  let rangeEnd: string | null = null

  if (period === 'custom' && customStart && customEnd) {
    rangeStart = customStart
    rangeEnd = customEnd + 'T23:59:59.999Z'
  } else if (period === 'today') {
    const d = now.toISOString().split('T')[0]
    rangeStart = d + 'T00:00:00.000Z'
    rangeEnd = d + 'T23:59:59.999Z'
  } else if (period === 'week') {
    // Monday of this week
    const day = now.getDay() === 0 ? 6 : now.getDay() - 1 // Mon = 0
    const monday = new Date(now)
    monday.setDate(now.getDate() - day)
    rangeStart = monday.toISOString().split('T')[0] + 'T00:00:00.000Z'
    rangeEnd = now.toISOString()
  } else if (period === 'month') {
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    rangeStart = `${y}-${m}-01T00:00:00.000Z`
    rangeEnd = now.toISOString()
  }
  // period === 'all' → rangeStart/rangeEnd stay null (no date filter)

  const supabase = createServiceClient()

  // Fetch all active SDRs and Closers with targets + names
  const { data: members } = await supabase
    .from('users')
    .select('id, name, role, monthly_demo_target, monthly_revenue_target, monthly_base_salary, pip_status')
    .in('role', ['sdr', 'closer'])
    .eq('is_active', true)

  if (!members || members.length === 0) {
    return NextResponse.json({ sdrs: [], closers: [] })
  }

  // ── Helper: build date filter for a query ─────────────────────────────────
  function applyDateFilter<T extends object>(
    query: ReturnType<typeof supabase.from<string, T>['select']>,
    column: string
  ) {
    if (rangeStart) query = query.gte(column, rangeStart)
    if (rangeEnd) query = query.lte(column, rangeEnd)
    return query
  }

  const sdrResults = await Promise.all(
    members.filter(m => m.role === 'sdr').map(async (sdr) => {
      // 1. Demos booked in period
      let demosQuery = supabase
        .from('demos')
        .select('id, status', { count: 'exact' })
        .eq('sdr_id', sdr.id)

      if (rangeStart) demosQuery = demosQuery.gte('created_at', rangeStart)
      if (rangeEnd) demosQuery = demosQuery.lte('created_at', rangeEnd)

      const { data: demosInPeriod, count: demosBooked } = await demosQuery

      // 1b. Demos attended in period (from demo_date perspective)
      let attendedQuery = supabase
        .from('demos')
        .select('id', { count: 'exact', head: true })
        .eq('sdr_id', sdr.id)
        .eq('status', 'attended')

      if (rangeStart) attendedQuery = attendedQuery.gte('demo_date', rangeStart)
      if (rangeEnd) attendedQuery = attendedQuery.lte('demo_date', rangeEnd)

      const { count: demosAttended } = await attendedQuery

      // 2. Demo outcomes (attended vs no_show) — all time for this SDR's demos
      //    (no_show attribution is on demo record, not time-bounded — reflects lifetime quality)
      const { data: allDemoOutcomes } = await supabase
        .from('demos')
        .select('id, status')
        .eq('sdr_id', sdr.id)
        .in('status', ['attended', 'no_show'])

      const totalAttended = (allDemoOutcomes ?? []).filter(d => d.status === 'attended').length
      const totalNoShow = (allDemoOutcomes ?? []).filter(d => d.status === 'no_show').length
      const totalCompleted = totalAttended + totalNoShow
      const showUpRate = totalCompleted >= 3
        ? Math.round((totalAttended / totalCompleted) * 100)
        : null // too few samples

      // 3. Leads reached out (activities by this SDR in period)
      let activitiesQuery = supabase
        .from('activities')
        .select('id', { count: 'exact', head: true })
        .eq('performed_by', sdr.id)
        .in('activity_type', ['call', 'email', 'whatsapp', 'linkedin'])

      if (rangeStart) activitiesQuery = activitiesQuery.gte('created_at', rangeStart)
      if (rangeEnd) activitiesQuery = activitiesQuery.lte('created_at', rangeEnd)

      const { count: leadsReachedOut } = await activitiesQuery

      // 4. Conversion bonus — deals Won/Converted sourced from this SDR's demos
      const demoIds = (demosInPeriod ?? []).map(d => d.id)

      let unqualifiedCount = 0
      let convertedCount = 0

      if (demoIds.length > 0) {
        const { count: unq } = await supabase
          .from('deals')
          .select('id', { count: 'exact', head: true })
          .eq('sdr_id', sdr.id)
          .eq('stage', 'unqualified')

        const { count: conv } = await supabase
          .from('deals')
          .select('id', { count: 'exact', head: true })
          .eq('sdr_id', sdr.id)
          .in('stage', ['won', 'converted'])

        unqualifiedCount = unq ?? 0
        convertedCount = conv ?? 0
      }

      // 5. Cold call → demo %
      const totalLeads = leadsReachedOut ?? 0
      const totalDemos = demosBooked ?? 0
      const coldCallToDemo = totalLeads > 0
        ? Math.round((totalDemos / totalLeads) * 100)
        : null

      // 6. Achievement %
      const target = sdr.monthly_demo_target ?? 0
      const achievementPct = target > 0 ? Math.round((totalDemos / target) * 100) : null

      return {
        user_id: sdr.id,
        name: sdr.name,
        role: 'sdr' as const,
        pip_status: sdr.pip_status,
        monthly_demo_target: sdr.monthly_demo_target,
        // Metrics
        demos_booked: totalDemos,
        demos_attended: demosAttended ?? 0,
        leads_reached_out: totalLeads,
        cold_call_to_demo_pct: coldCallToDemo,
        no_shows: totalNoShow,
        show_up_rate: showUpRate,
        unqualified: unqualifiedCount,
        already_converted: convertedCount,
        achievement_pct: achievementPct,
      }
    })
  )

  const closerResults = await Promise.all(
    members.filter(m => m.role === 'closer').map(async (closer) => {
      // 1. Demos attended (done) in period — demos where closer_id = X and status = attended
      let demosDoneQuery = supabase
        .from('demos')
        .select('id, demo_date', { count: 'exact' })
        .eq('closer_id', closer.id)
        .eq('status', 'attended')

      if (rangeStart) demosDoneQuery = demosDoneQuery.gte('demo_date', rangeStart)
      if (rangeEnd) demosDoneQuery = demosDoneQuery.lte('demo_date', rangeEnd)

      const { count: demosDone } = await demosDoneQuery

      // 2. Deals Won in period
      let wonQuery = supabase
        .from('deals')
        .select('id, deal_value, created_at, updated_at')
        .eq('closer_id', closer.id)
        .eq('stage', 'won')

      if (rangeStart) wonQuery = wonQuery.gte('updated_at', rangeStart)
      if (rangeEnd) wonQuery = wonQuery.lte('updated_at', rangeEnd)

      const { data: wonDeals } = await wonQuery
      const converted = (wonDeals ?? []).length
      const revenueWon = (wonDeals ?? []).reduce((s, d) => s + (d.deal_value ?? 0), 0)

      // 3. Conversion %
      const conversionPct = (demosDone ?? 0) > 0
        ? Math.round((converted / (demosDone ?? 1)) * 100)
        : null

      // 4. ASP
      const asp = converted > 0 ? Math.round(revenueWon / converted) : null

      // 5. Active pipeline deals (non-terminal, non-removed)
      const { count: inPipeline } = await supabase
        .from('deals')
        .select('id', { count: 'exact', head: true })
        .eq('closer_id', closer.id)
        .not('stage', 'in', '("won","lost","ghosted","unqualified","converted","invoice_sent")')
        .eq('removed_from_board', false)

      // 6. Interested (follow_up + negotiation)
      const { count: interested } = await supabase
        .from('deals')
        .select('id', { count: 'exact', head: true })
        .eq('closer_id', closer.id)
        .in('stage', ['follow_up', 'negotiation'])
        .eq('removed_from_board', false)

      // 7. Follows on track (next_follow_up >= today)
      const todayStr = now.toISOString().split('T')[0]
      const { count: followsOnTrack } = await supabase
        .from('deals')
        .select('id', { count: 'exact', head: true })
        .eq('closer_id', closer.id)
        .gte('next_follow_up', todayStr)
        .not('stage', 'in', '("won","lost","ghosted","unqualified","converted")')

      // 8. Avg deal cycle (days from deal created_at to updated_at for won deals)
      let avgDealCycle: number | null = null
      if ((wonDeals ?? []).length > 0) {
        const cycles = (wonDeals ?? [])
          .map(d => Math.floor((new Date(d.updated_at).getTime() - new Date(d.created_at).getTime()) / 86400000))
          .filter(n => n >= 0)
        if (cycles.length > 0) {
          avgDealCycle = Math.round(cycles.reduce((a, b) => a + b, 0) / cycles.length)
        }
      }

      // 9. Achievement %
      const target = closer.monthly_revenue_target ?? 0
      const achievementPct = target > 0 ? Math.round((revenueWon / target) * 100) : null

      return {
        user_id: closer.id,
        name: closer.name,
        role: 'closer' as const,
        pip_status: closer.pip_status,
        monthly_revenue_target: closer.monthly_revenue_target,
        // Metrics
        demos_done: demosDone ?? 0,
        converted,
        revenue_won: revenueWon,
        conversion_pct: conversionPct,
        asp,
        in_pipeline: inPipeline ?? 0,
        interested: interested ?? 0,
        follows_on_track: followsOnTrack ?? 0,
        avg_deal_cycle: avgDealCycle,
        achievement_pct: achievementPct,
      }
    })
  )

  return NextResponse.json({
    period,
    range_start: rangeStart,
    range_end: rangeEnd,
    sdrs: sdrResults,
    closers: closerResults,
  })
}
