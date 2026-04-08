import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TopBar from '@/components/layout/TopBar'
import KpiCard from '@/components/dashboard/KpiCard'
import { formatCurrency, getWorkingDaysElapsed } from '@/lib/utils'

export default async function CloserDashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('id, name, role, monthly_revenue_target')
    .eq('auth_id', user.id)
    .single()

  if (!profile) redirect('/login')

  // No targets set yet — show pending setup screen
  if (profile.monthly_revenue_target === null || profile.monthly_revenue_target === 0) {
    return (
      <div className="flex-1 flex flex-col">
        <TopBar title={`Welcome, ${profile.name.split(' ')[0]} 👋`} subtitle="Your workspace is almost ready" />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md text-center">
            <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">⏳</span>
            </div>
            <h2 className="text-lg font-semibold text-[#0F172A] mb-2">Waiting for targets</h2>
            <p className="text-sm text-[#64748B] leading-relaxed">
              Your account is set up! Your manager needs to assign your monthly revenue target before your dashboard activates.
            </p>
            <p className="text-xs text-[#94A3B8] mt-4">
              Once targets are set, your pipeline, KPIs, and commission tracker will appear here.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  const daysElapsed = getWorkingDaysElapsed(year, month)
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
  const today = now.toISOString().split('T')[0]

  const [wonRes, pipelineRes, todayDemosRes, followupsRes, commRes] = await Promise.all([
    // Revenue won this month
    supabase.from('deals').select('deal_value').eq('closer_id', profile.id)
      .eq('stage', 'won').gte('date_won_lost', monthStart),
    // Active pipeline count (not won/lost/ghosted)
    supabase.from('deals').select('id', { count: 'exact', head: true }).eq('closer_id', profile.id)
      .not('stage', 'in', '("won","lost","ghosted","converted")'),
    // Today's demos
    supabase.from('demos').select('id', { count: 'exact', head: true }).eq('closer_id', profile.id)
      .gte('demo_date', today).lt('demo_date', `${today}T23:59:59`),
    // Overdue follow-ups
    supabase.from('deals').select('id', { count: 'exact', head: true }).eq('closer_id', profile.id)
      .lte('next_follow_up', today).not('stage', 'in', '("won","lost","ghosted")'),
    // This month's commission
    supabase.from('commissions').select('commission_amt').eq('user_id', profile.id)
      .eq('month', month).eq('year', year),
  ])

  const revenueWon = (wonRes.data ?? []).reduce((sum, d) => sum + (d.deal_value ?? 0), 0)
  const activePipeline = pipelineRes.count ?? 0
  const todayDemos = todayDemosRes.count ?? 0
  const overdueFollowups = followupsRes.count ?? 0
  const commissionEarned = (commRes.data ?? []).reduce((sum, c) => sum + (c.commission_amt ?? 0), 0)
  const target = profile.monthly_revenue_target

  const expectedByNow = target > 0 ? (target / 26) * daysElapsed : 0
  const paceRatio = expectedByNow > 0 ? revenueWon / expectedByNow : 1
  const paceColor = paceRatio >= 1.05 ? '#059669' : paceRatio >= 0.85 ? '#1A56DB' : paceRatio >= 0.6 ? '#F59E0B' : '#EF4444'
  const progressPercent = target > 0 ? Math.min(Math.round((revenueWon / target) * 100), 100) : 0
  const achievementPct = target > 0 ? Math.round((revenueWon / target) * 100) : 0

  // Commission zone label
  const commissionZone =
    achievementPct >= 120 ? '🚀 Accelerator Zone (120%+)'
    : achievementPct >= 100 ? '✅ Bonus Zone (100–119%)'
    : achievementPct >= 70 ? '📈 Standard Zone (70–99%)'
    : '⚠️ Below Threshold (<70%)'
  const zoneColor = achievementPct >= 100 ? '#059669' : achievementPct >= 70 ? '#1A56DB' : '#F59E0B'

  return (
    <div className="flex-1 flex flex-col">
      <TopBar
        title={`Pipeline · ${profile.name.split(' ')[0]}`}
        subtitle={`Day ${daysElapsed}/26 · ${achievementPct}% of monthly target`}
        monthlyTarget={target}
        achieved={revenueWon}
        role="closer"
      />

      <div className="flex-1 p-6 space-y-6">

        {/* ── COMMISSION ZONE (HERO) ── */}
        <div className="bg-white rounded-xl border-2 p-5 shadow-sm" style={{ borderColor: zoneColor }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Commission Zone</p>
              <p className="text-lg font-bold mt-0.5" style={{ color: zoneColor }}>{commissionZone}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-[#94A3B8] uppercase tracking-widest">Earned this month</p>
              <p className="text-2xl font-bold text-[#0F172A]">{formatCurrency(commissionEarned)}</p>
            </div>
          </div>

          {/* Revenue progress bar */}
          <div className="flex items-center justify-between text-xs text-[#94A3B8] mb-1.5">
            <span>Revenue: <span className="font-semibold text-[#0F172A]">{formatCurrency(revenueWon)}</span></span>
            <span>Target: {formatCurrency(target)}</span>
          </div>
          <div className="relative h-3 bg-[#F1F5F9] rounded-full overflow-hidden">
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-[#94A3B8] z-10"
              style={{ left: `${Math.min((expectedByNow / target) * 100, 100)}%` }}
            />
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%`, backgroundColor: paceColor }}
            />
          </div>
        </div>

        {/* ── KPI GRID ── */}
        <div className="grid grid-cols-4 gap-4">
          <KpiCard
            label="Revenue Won"
            value={formatCurrency(revenueWon)}
            subtitle={`${achievementPct}% of target`}
            accentColor="#059669"
          />
          <KpiCard
            label="Active Pipeline"
            value={activePipeline}
            subtitle="Open deals"
            accentColor="#1A56DB"
          />
          <KpiCard
            label="Today's Demos"
            value={todayDemos}
            subtitle="Scheduled today"
            accentColor="#7C3AED"
          />
          <KpiCard
            label="Overdue Follow-ups"
            value={overdueFollowups}
            subtitle="Needs action"
            accentColor={overdueFollowups > 0 ? '#EF4444' : '#059669'}
          />
        </div>

        {/* ── QUICK LINKS ── */}
        <div className="grid grid-cols-2 gap-4">
          <a href="/closer/pipeline" className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm hover:border-[#1A56DB] hover:shadow-md transition-all group">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#64748B] mb-1">Active Pipeline</p>
            <p className="text-2xl font-bold text-[#0F172A] group-hover:text-[#1A56DB] transition-colors">{activePipeline} deals</p>
            <p className="text-xs text-[#94A3B8] mt-1">Open Kanban board →</p>
          </a>
          <a href="/closer/today" className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm hover:border-[#7C3AED] hover:shadow-md transition-all group">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#64748B] mb-1">Today's Actions</p>
            <p className={`text-2xl font-bold ${overdueFollowups > 0 ? 'text-[#EF4444]' : 'text-[#0F172A]'} group-hover:text-[#7C3AED] transition-colors`}>
              {todayDemos} demos · {overdueFollowups} follow-ups
            </p>
            <p className="text-xs text-[#94A3B8] mt-1">View today's agenda →</p>
          </a>
        </div>

      </div>
    </div>
  )
}
