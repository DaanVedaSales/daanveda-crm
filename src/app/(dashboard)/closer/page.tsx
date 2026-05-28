import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TopBar from '@/components/layout/TopBar'
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

  if (!profile.monthly_revenue_target) {
    return (
      <div className="flex-1 flex flex-col">
        <TopBar
          title={`Welcome, ${profile.name.split(' ')[0]}`}
          subtitle="Your workspace is almost ready"
        />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-sm text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center mx-auto mb-4">
              <div className="w-5 h-5 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
            </div>
            <h2 className="text-[15px] font-semibold text-[#0F172A] mb-2">Awaiting target assignment</h2>
            <p className="text-[13px] text-[#64748B] leading-relaxed">
              Your manager needs to assign a monthly revenue target before your dashboard activates.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const now          = new Date()
  const month        = now.getMonth() + 1
  const year         = now.getFullYear()
  const daysElapsed  = getWorkingDaysElapsed(year, month)
  const monthStart   = `${year}-${String(month).padStart(2, '0')}-01`
  const today        = now.toISOString().split('T')[0]
  const sevenDaysLater = new Date(now)
  sevenDaysLater.setDate(sevenDaysLater.getDate() + 7)
  const weekEnd = sevenDaysLater.toISOString().split('T')[0]

  const [wonRes, pipelineRes, todayDemosRes, followupsRes, commRes, upcomingDemosRes] = await Promise.all([
    supabase.from('deals').select('deal_value').eq('closer_id', profile.id).in('stage', ['won', 'converted']).gte('date_won_lost', monthStart),
    supabase.from('deals').select('id', { count: 'exact', head: true }).eq('closer_id', profile.id)
      .not('stage', 'in', '("won","lost","ghosted","converted")')
      .or('removed_from_board.is.null,removed_from_board.eq.false'),
    supabase.from('demos').select('id', { count: 'exact', head: true }).eq('closer_id', profile.id)
      .gte('demo_date', `${today}T00:00:00`).lte('demo_date', `${today}T23:59:59`)
      .in('status', ['scheduled', 'rescheduled']),
    supabase.from('deals').select('id', { count: 'exact', head: true }).eq('closer_id', profile.id)
      .lte('next_follow_up', today).not('stage', 'in', '("won","lost","ghosted")'),
    supabase.from('commissions').select('commission_amt').eq('user_id', profile.id).eq('month', month).eq('year', year),
    supabase.from('demos')
      .select('id, demo_date, organization:organizations(name), sdr:users!demos_sdr_id_fkey(name)')
      .eq('closer_id', profile.id)
      .in('status', ['scheduled', 'rescheduled'])
      .gte('demo_date', `${today}T00:00:00`)
      .lte('demo_date', `${weekEnd}T23:59:59`)
      .order('demo_date', { ascending: true })
      .limit(8),
  ])

  const revenueWon       = (wonRes.data ?? []).reduce((s, d) => s + (d.deal_value ?? 0), 0)
  const activePipeline   = pipelineRes.count ?? 0
  const todayDemos       = todayDemosRes.count ?? 0
  const overdueFollowups = followupsRes.count ?? 0
  const commissionEarned = (commRes.data ?? []).reduce((s, c) => s + (c.commission_amt ?? 0), 0)
  const upcomingDemos    = (upcomingDemosRes.data ?? []) as any[]
  const target           = profile.monthly_revenue_target

  const expectedByNow   = target > 0 ? (target / 26) * daysElapsed : 0
  const paceRatio       = expectedByNow > 0 ? revenueWon / expectedByNow : 1
  const paceColor       = paceRatio >= 1.05 ? '#059669' : paceRatio >= 0.85 ? '#1A56DB' : paceRatio >= 0.6 ? '#F59E0B' : '#EF4444'
  const progressPercent = target > 0 ? Math.min((revenueWon / target) * 100, 100) : 0
  const achievementPct  = target > 0 ? Math.round((revenueWon / target) * 100) : 0

  const zoneLabel =
    achievementPct >= 120 ? 'Accelerator Zone'
    : achievementPct >= 100 ? 'Bonus Zone'
    : achievementPct >= 70  ? 'Standard Zone'
    : 'Below Threshold'

  const zoneColor =
    achievementPct >= 100 ? '#059669'
    : achievementPct >= 70  ? '#1A56DB'
    : '#F59E0B'

  const paceDotColor = paceRatio >= 1 ? '#059669' : paceRatio >= 0.8 ? '#F59E0B' : '#EF4444'

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-[#F8FAFC]">
      <TopBar
        title={`${profile.name.split(' ')[0]}'s Dashboard`}
        subtitle={`Day ${daysElapsed} of 26 · ${achievementPct}% toward target`}
      />

      <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-5 animate-in-page">

        {/* ── COMMISSION HERO ─────────────────────────────────────────────── */}
        <div
          className="bg-white rounded-2xl p-6 border"
          style={{
            borderColor: zoneColor + '35',
            boxShadow: `0 4px 20px rgba(15,23,42,0.06), 0 0 0 1px ${zoneColor}18`,
          }}
        >
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-label text-[#64748B] mb-1.5">Commission Zone</p>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: zoneColor }} />
                <p className="text-[17px] font-semibold tracking-tight" style={{ color: zoneColor }}>
                  {zoneLabel}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-label text-[#94A3B8] mb-1">Earned this month</p>
              <p
                className="text-[2rem] font-bold text-[#0F172A]"
                style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em' }}
              >
                {formatCurrency(commissionEarned)}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#94A3B8] mb-2">
            <span>
              Revenue: <span className="font-semibold text-[#0F172A]">{formatCurrency(revenueWon)}</span>
            </span>
            <span>Target: <span className="font-medium text-[#64748B]">{formatCurrency(target)}</span></span>
          </div>
          <div className="relative h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
            <div
              className="absolute top-0 bottom-0 w-px bg-[#CBD5E1] z-10"
              style={{ left: `${Math.min((expectedByNow / target) * 100, 100)}%` }}
            />
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${progressPercent}%`, backgroundColor: paceColor }}
            />
          </div>
          <div className="flex items-center mt-2.5 text-[10px] text-[#94A3B8]">
            <span className="flex items-center gap-1">
              <div className="w-px h-3 bg-[#CBD5E1]" />
              <span>Expected today: {formatCurrency(expectedByNow)}</span>
            </span>
            <span className="ml-auto flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: paceDotColor }} />
              <span style={{ color: paceDotColor }}>
                {paceRatio >= 1 ? 'On pace' : paceRatio >= 0.8 ? 'Slightly behind' : 'Behind pace'}
              </span>
            </span>
          </div>
        </div>

        {/* ── 3 STAT TILES ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Today's Demos",       value: todayDemos,       href: '/closer/today',    color: '#7C3AED', sub: 'scheduled today'  },
            { label: 'Active Pipeline',      value: activePipeline,   href: '/closer/pipeline', color: '#1A56DB', sub: 'open deals'        },
            { label: 'Overdue Follow-ups',   value: overdueFollowups, href: '/closer/pipeline', color: overdueFollowups > 0 ? '#EF4444' : '#059669', sub: overdueFollowups > 0 ? 'needs action' : 'all clear' },
          ].map(stat => (
            <a
              key={stat.label}
              href={stat.href}
              className="group bg-white rounded-2xl border border-[#E2E8F0] p-5 hover:border-[#CBD5E1] transition-all duration-150"
              style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.06)' }}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-label text-[#64748B]">{stat.label}</p>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: stat.color }} />
              </div>
              <p
                className="text-[2rem] font-bold"
                style={{ color: stat.color, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em' }}
              >
                {stat.value}
              </p>
              <p className="text-[11px] text-[#94A3B8] mt-2 group-hover:text-[#64748B] transition-colors">
                {stat.sub} ↗
              </p>
            </a>
          ))}
        </div>

        {/* ── UPCOMING DEMOS LIST ──────────────────────────────────────────── */}
        {upcomingDemos.length > 0 ? (
          <div
            className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden"
            style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.06)' }}
          >
            <div className="px-5 py-4 border-b border-[#F1F5F9] flex items-center justify-between">
              <div>
                <p className="text-label text-[#64748B]">Upcoming Demos</p>
                <p className="text-[13px] font-semibold text-[#0F172A] mt-0.5">Next 7 days</p>
              </div>
              <a
                href="/closer/today"
                className="text-[12px] font-medium text-[#1A56DB] hover:text-[#1743B0] transition-colors"
              >
                View all
              </a>
            </div>
            <div className="divide-y divide-[#F1F5F9]">
              {upcomingDemos.map((demo: any) => {
                const demoDate  = new Date(demo.demo_date)
                const isToday   = demoDate.toISOString().split('T')[0] === today
                const dayLabel  = isToday ? 'Today' : demoDate.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
                const timeLabel = demoDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
                return (
                  <div key={demo.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-[#F8FAFC] transition-colors">
                    <div>
                      <p className="text-[13px] font-medium text-[#0F172A]">{demo.organization?.name}</p>
                      <p className="text-[11px] text-[#94A3B8] mt-0.5">via {demo.sdr?.name ?? '—'}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-[12px] font-semibold ${isToday ? 'text-[#1A56DB]' : 'text-[#374151]'}`}>
                        {dayLabel}
                      </p>
                      <p className="text-[11px] text-[#94A3B8] mt-0.5">{timeLabel}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div
            className="bg-white rounded-2xl border border-[#E2E8F0] p-10 text-center"
            style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.06)' }}
          >
            <div className="w-10 h-10 rounded-xl bg-[#F1F5F9] flex items-center justify-center mx-auto mb-3">
              <svg className="w-5 h-5 text-[#94A3B8]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
                />
              </svg>
            </div>
            <p className="text-[13px] font-medium text-[#374151]">No demos in the next 7 days</p>
            <p className="text-[11px] text-[#94A3B8] mt-1">Scheduled demos will appear here</p>
          </div>
        )}
      </div>
    </div>
  )
}
