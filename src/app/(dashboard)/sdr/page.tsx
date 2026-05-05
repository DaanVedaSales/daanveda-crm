import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TopBar from '@/components/layout/TopBar'
import KpiCard from '@/components/dashboard/KpiCard'
import { formatCurrency, getWorkingDaysElapsed } from '@/lib/utils'

export default async function SDRDashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('id, name, role, monthly_demo_target, monthly_revenue_target')
    .eq('auth_id', user.id)
    .single()

  if (!profile) redirect('/login')

  // No targets set yet — show a pending setup screen
  const targetsNotSet = profile.monthly_demo_target === null || profile.monthly_demo_target === 0

  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  const daysElapsed = getWorkingDaysElapsed(year, month)

  // KPIs
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`

  const [demosRes, leadsRes, callsRes, followupsRes] = await Promise.all([
    supabase.from('demos').select('id', { count: 'exact', head: true }).eq('sdr_id', profile.id)
      .gte('created_at', monthStart),
    supabase.from('leads').select('id', { count: 'exact', head: true }).eq('assigned_to', profile.id).eq('phase', 'sdr'),
    supabase.from('activities').select('id', { count: 'exact', head: true }).eq('user_id', profile.id)
      .eq('activity_type', 'call').gte('created_at', monthStart),
    supabase.from('leads').select('id', { count: 'exact', head: true }).eq('assigned_to', profile.id)
      .lte('follow_up_date', new Date().toISOString().split('T')[0])
      .in('status', ['call_again', 'follow_up']),
  ])

  const demosBooked = demosRes.count ?? 0
  const activeLeads = leadsRes.count ?? 0
  const callsToday = callsRes.count ?? 0
  const overdueFollowups = followupsRes.count ?? 0
  const target = profile.monthly_demo_target ?? 0

  // Pace calculations
  const dailyTarget = target > 0 ? target / 26 : 0
  const expectedByNow = dailyTarget * daysElapsed
  const paceRatio = expectedByNow > 0 ? demosBooked / expectedByNow : 1
  const pacePercent = Math.min(Math.round(paceRatio * 100), 150)
  const paceColor = paceRatio >= 1.05 ? '#059669' : paceRatio >= 0.85 ? '#1A56DB' : paceRatio >= 0.6 ? '#F59E0B' : '#EF4444'

  const progressPercent = target > 0 ? Math.min(Math.round((demosBooked / target) * 100), 100) : 0

  // Show pending setup message if no targets assigned yet
  if (targetsNotSet) {
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
              Your account is set up! Your manager needs to assign your monthly demo target and revenue target before your dashboard is active.
            </p>
            <p className="text-xs text-[#94A3B8] mt-4">
              Once targets are set, this page will show your pace tracker, KPIs, and leads.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      <TopBar
        title={`Good morning, ${profile.name.split(' ')[0]} 👋`}
        subtitle={`Day ${daysElapsed} of 26 working days this month`}
        monthlyTarget={target}
        achieved={demosBooked}
        role="sdr"
      />

      <div className="flex-1 p-6 space-y-6">

        {/* ── PACE BAR (HERO) ── */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Monthly Demo Pace</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-bold text-[#0F172A]">{demosBooked}</span>
                <span className="text-sm text-[#94A3B8]">of {target} demos</span>
                <span className="text-sm font-semibold" style={{ color: paceColor }}>
                  {pacePercent}% of pace
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-[#94A3B8] uppercase tracking-widest">Expected by now</p>
              <p className="text-lg font-semibold text-[#64748B]">{Math.round(expectedByNow)} demos</p>
              <p className="text-xs text-[#94A3B8]">Daily target: {dailyTarget.toFixed(1)}/day</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="relative h-3 bg-[#F1F5F9] rounded-full overflow-hidden">
            {/* Expected marker */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-[#94A3B8] z-10"
              style={{ left: `${Math.min((expectedByNow / target) * 100, 100)}%` }}
            />
            {/* Achieved */}
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%`, backgroundColor: paceColor }}
            />
          </div>
          <div className="flex justify-between mt-1.5 text-[10px] text-[#94A3B8]">
            <span>0</span>
            <span className="text-[#64748B]">Target: {target} demos</span>
          </div>
        </div>

        {/* ── KPI GRID ── */}
        <div className="grid grid-cols-4 gap-4">
          <KpiCard
            label="Demos Booked"
            value={demosBooked}
            subtitle={`Target: ${target}`}
            accentColor="#1A56DB"
          />
          <KpiCard
            label="Active Leads"
            value={activeLeads}
            subtitle="In your SDR queue"
            accentColor="#7C3AED"
          />
          <KpiCard
            label="Calls This Month"
            value={callsToday}
            subtitle="Activities logged"
            accentColor="#059669"
          />
          <KpiCard
            label="Overdue Follow-ups"
            value={overdueFollowups}
            subtitle="Needs action today"
            accentColor={overdueFollowups > 0 ? '#EF4444' : '#059669'}
          />
        </div>

        {/* ── QUICK LINKS ── */}
        <div className="grid grid-cols-2 gap-4">
          <a href="/sdr/leads" className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm hover:border-[#1A56DB] hover:shadow-md transition-all group">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#64748B] mb-1">Assigned Leads</p>
            <p className="text-2xl font-bold text-[#0F172A] group-hover:text-[#1A56DB] transition-colors">{activeLeads}</p>
            <p className="text-xs text-[#94A3B8] mt-1">Click to open leads workspace →</p>
          </a>
          <a href="/sdr/followups" className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm hover:border-[#F59E0B] hover:shadow-md transition-all group">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#64748B] mb-1">Follow-ups Due</p>
            <p className={`text-2xl font-bold ${overdueFollowups > 0 ? 'text-[#EF4444]' : 'text-[#0F172A]'} group-hover:text-[#F59E0B] transition-colors`}>{overdueFollowups}</p>
            <p className="text-xs text-[#94A3B8] mt-1">Click to open follow-up queue →</p>
          </a>
        </div>

      </div>
    </div>
  )
}
