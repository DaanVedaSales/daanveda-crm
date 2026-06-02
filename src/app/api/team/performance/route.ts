import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getNowIST } from '@/lib/utils'

// ── Commission structures ──────────────────────────────────────────────────────
//
// SDR: Flat per-won-deal (no achievement multiplier)
//   deal_value < ₹1L  → ₹200 per deal
//   deal_value ≥ ₹1L  → ₹500 per deal
//
// Closer: Tier-based on plan revenue × achievement %
//   Base Plan  (deal_value < ₹60K):          <70%→0%, 70-80%→1%, 80-100%→2%, 100-120%→4%, 120%+→6%
//   Mid Plan   (₹60K ≤ deal_value < ₹1.2L):  <70%→0%, 70-80%→2%, 80-100%→3%, 100-120%→6%, 120%+→8%
//   Custom Plan (deal_value ≥ ₹1.2L):         <70%→0%, 70-80%→4%, 80-100%→5%, 100-120%→8%, 120%+→10%
//   130%+ accelerator: +5% on (total revenue − 120% of target)

function closerTierRate(tier: 'base' | 'mid' | 'custom', pct: number): number {
  if (pct < 70) return 0
  if (tier === 'base')   return pct < 80 ? 0.01 : pct < 100 ? 0.02 : pct < 120 ? 0.04 : 0.06
  if (tier === 'mid')    return pct < 80 ? 0.02 : pct < 100 ? 0.03 : pct < 120 ? 0.06 : 0.08
  /* custom */           return pct < 80 ? 0.04 : pct < 100 ? 0.05 : pct < 120 ? 0.08 : 0.10
}

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

  // IST-based month boundary — server runs UTC, business operates in IST (UTC+5:30)
  const now = getNowIST()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`

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
      let est_incentive = 0

      if (member.role === 'sdr') {
        // Demo count for achievement % display
        const { count } = await supabase
          .from('demos')
          .select('id', { count: 'exact', head: true })
          .eq('sdr_id', member.id)
          .gte('created_at', monthStart)

        demos_this_month = count ?? 0
        const demoTarget = member.monthly_demo_target ?? 0
        achievement_pct = demoTarget > 0 ? Math.round((demos_this_month / demoTarget) * 100) : 0

        // Commission: per won deal from this SDR's demos — ₹200 (<₹1L) or ₹500 (≥₹1L)
        const { data: sdrDemos } = await supabase
          .from('demos')
          .select('id')
          .eq('sdr_id', member.id)
          .eq('is_deleted', false)
          .gte('created_at', monthStart)

        const sdrDemoIds = (sdrDemos ?? []).map((d: { id: string }) => d.id)

        if (sdrDemoIds.length > 0) {
          const { data: wonDeals } = await supabase
            .from('deals')
            .select('deal_value')
            .in('demo_id', sdrDemoIds)
            .eq('stage', 'won')
            .eq('is_deleted', false)

          est_incentive = (wonDeals ?? []).reduce((sum: number, d: { deal_value: number | null }) => {
            return sum + ((d.deal_value ?? 0) >= 100000 ? 500 : 200)
          }, 0)
        }

      } else {
        // Closer: won + converted deals this month
        const { data: wonDeals } = await supabase
          .from('deals')
          .select('deal_value')
          .eq('closer_id', member.id)
          .in('stage', ['won', 'converted'])
          .gte('date_won_lost', monthStart)

        revenue_this_month = (wonDeals ?? []).reduce((s: number, d: { deal_value: number | null }) => s + (d.deal_value ?? 0), 0)
        const revTarget = member.monthly_revenue_target ?? 0
        achievement_pct = revTarget > 0 ? Math.round((revenue_this_month / revTarget) * 100) : 0

        // Group by plan tier based on deal_value
        let basePlanRev = 0, midPlanRev = 0, customPlanRev = 0
        for (const deal of wonDeals ?? []) {
          const v = (deal as { deal_value: number | null }).deal_value ?? 0
          if (v < 60000)       basePlanRev += v
          else if (v < 120000) midPlanRev  += v
          else                 customPlanRev += v
        }

        const mainCommission =
          basePlanRev   * closerTierRate('base',   achievement_pct) +
          midPlanRev    * closerTierRate('mid',    achievement_pct) +
          customPlanRev * closerTierRate('custom', achievement_pct)

        // 130%+ accelerator
        const acceleratorBase = revTarget > 0 ? revenue_this_month - (revTarget * 1.2) : 0
        const accelerator = achievement_pct >= 130 && acceleratorBase > 0
          ? Math.round(acceleratorBase * 0.05)
          : 0

        est_incentive = Math.round(mainCommission + accelerator)
      }

      const base_salary = member.monthly_base_salary ?? 0

      return {
        user_id: member.id,
        role: member.role,
        demos_this_month,
        revenue_this_month,
        achievement_pct,
        est_incentive,
        base_salary,
        total_payout: base_salary + est_incentive,
      }
    })
  )

  return NextResponse.json(results)
}
