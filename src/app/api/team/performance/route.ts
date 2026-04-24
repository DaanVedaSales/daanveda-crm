import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// Commission formula (mirrors COMMISSION_ACHIEVEMENT_RATES in constants.ts)
function getAchievementMultiplier(pct: number): number {
  if (pct < 70) return 0
  if (pct < 100) return 1
  if (pct < 120) return 1.25
  return 1.5
}

// SDR: ₹500 per demo booked × achievement multiplier
const SDR_PER_DEMO_RATE = 500

// Closer: 7% of revenue closed × achievement multiplier
// (mid-tier rate from commission plan — applies to total monthly revenue)
const CLOSER_COMMISSION_RATE = 0.07

// GET /api/team/performance — this month's achievement + payout estimates (admin only)
export async function GET() {
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

  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`

  // All active SDRs and Closers
  const { data: members } = await supabase
    .from('users')
    .select('id, role, monthly_demo_target, monthly_revenue_target, monthly_base_salary')
    .in('role', ['sdr', 'closer'])
    .eq('is_active', true)

  if (!members || members.length === 0) return NextResponse.json([])

  const results = await Promise.all(
    members.map(async (member) => {
      let demos_this_month = 0
      let revenue_this_month = 0
      let achievement_pct = 0

      if (member.role === 'sdr') {
        const { count } = await supabase
          .from('demos')
          .select('id', { count: 'exact', head: true })
          .eq('sdr_id', member.id)
          .gte('created_at', monthStart)

        demos_this_month = count ?? 0
        const target = member.monthly_demo_target ?? 0
        achievement_pct = target > 0 ? Math.round((demos_this_month / target) * 100) : 0
      } else {
        const { data: wonDeals } = await supabase
          .from('deals')
          .select('deal_value')
          .eq('closer_id', member.id)
          .eq('stage', 'won')
          .gte('created_at', monthStart)

        revenue_this_month = (wonDeals ?? []).reduce((sum, d) => sum + (d.deal_value ?? 0), 0)
        const target = member.monthly_revenue_target ?? 0
        achievement_pct = target > 0 ? Math.round((revenue_this_month / target) * 100) : 0
      }

      const multiplier = getAchievementMultiplier(achievement_pct)

      const est_incentive = member.role === 'sdr'
        ? Math.round(demos_this_month * SDR_PER_DEMO_RATE * multiplier)
        : Math.round(revenue_this_month * CLOSER_COMMISSION_RATE * multiplier)

      const base_salary = member.monthly_base_salary ?? 0
      const total_payout = base_salary + est_incentive

      return {
        user_id: member.id,
        role: member.role,
        demos_this_month,
        revenue_this_month,
        achievement_pct,
        multiplier,
        est_incentive,
        base_salary,
        total_payout,
      }
    })
  )

  return NextResponse.json(results)
}
