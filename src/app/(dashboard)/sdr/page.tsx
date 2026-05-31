import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TopBar from '@/components/layout/TopBar'
import KpiCard from '@/components/dashboard/KpiCard'
import { getWorkingDaysElapsed } from '@/lib/utils'

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

  const targetsNotSet = !profile.monthly_demo_target

  const now         = new Date()
  const month       = now.getMonth() + 1
  const year        = now.getFullYear()
  const daysElapsed = getWorkingDaysElapsed(year, month)
  const monthStart  = `${year}-${String(month).padStart(2, '0')}-01`
  const today       = now.toISOString().split('T')[0]

  const [demosRes, leadsRes, followupsRes, noShowRes] = await Promise.all([
    supabase.from('demos').select('id', { count: 'exact', head: true }).eq('sdr_id', profile.id).gte('created_at', monthStart),
    supabase.from('leads').select('id', { count: 'exact', head: true }).eq('assigned_to', profile.id).eq('phase', 'sdr'),
    supabase.from('leads').select('id', { count: 'exact', head: true }).eq('assigned_to', profile.id)
      .lte('follow_up_date', today).in('status', ['call_again', 'follow_up']),
    supabase.from('leads').select('id', { count: 'exact', head: true }).eq('assigned_to', profile.id)
      .eq('status', 'no_show').eq('is_deleted', false),
  ])

  const demosBooked        = demosRes.count ?? 0
  const activeLeads        = leadsRes.count ?? 0
  const overdueFollowups   = followupsRes.count ?? 0
  const pendingReschedule  = noShowRes.count ?? 0
  const target           = profile.monthly_demo_target ?? 0

  const dailyTarget     = target > 0 ? target / 26 : 0
  const expectedByNow   = dailyTarget * daysElapsed
  const paceRatio       = expectedByNow > 0 ? demosBooked / expectedByNow : 1
  const pacePercent     = Math.round(paceRatio * 100)
  const paceColor       = paceRatio >= 1.05 ? '#059669' : paceRatio >= 0.85 ? '#1A56DB' : paceRatio >= 0.6 ? '#F59E0B' : '#EF4444'
  const progressPercent = target > 0 ? Math.min((demosBooked / target) * 100, 100) : 0
  const paceDotColor    = paceRatio >= 1 ? '#059669' : paceRatio >= 0.8 ? '#F59E0B' : '#EF4444'

  if (targetsNotSet) {
    return (
      <div className="flex-1 flex flex-col">
        <TopBar title={`Welcome, ${profile.name.split(' ')[0]}`} subtitle="Your workspace is almost ready" />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-sm text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center mx-auto mb-4">
              <div className="w-5 h-5 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
            </div>
            <h2 className="text-[15px] font-semibold text-[#0F172A] mb-2">Awaiting target assignment</h2>
            <p className="text-[13px] text-[#64748B] leading-relaxed">
              Your manager needs to set your monthly demo target before this dashboard activates.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-[#F8FAFC]">
      <TopBar
        title={`${profile.name.split(' ')[0]}'s Dashboard`}
        subtitle={`Day ${daysElapsed} of 26 · ${pacePercent}% of demo pace`}
      />

      <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-5 animate-in-page">

        {/* ── PACE HERO ───────────────────────────────────────────────────── */}
        <div
          className="bg-white rounded-2xl p-6 border border-[#E2E8F0]"
          style={{ boxShadow: '0 4px 20px rgba(15,23,42,0.06)' }}
        >
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-label text-[#64748B] mb-1.5">Demo Pace</p>
              <div className="flex items-baseline gap-2.5">
                <span
                  className="text-[2.25rem] font-bold text-[#0F172A]"
                  style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em' }}
                >
                  {demosBooked}
                </span>
                <span className="text-[13px] text-[#94A3B8]">of {target} demos</span>
                <span
                  className="text-[13px] font-semibold"
                  style={{ color: paceColor }}
                >
                  {pacePercent}%
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-label text-[#94A3B8] mb-1">Expected by today</p>
              <p
                className="text-[1.375rem] font-semibold text-[#374151]"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {Math.round(expectedByNow)}
              </p>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">
                {dailyTarget.toFixed(1)} demos/day
              </p>
            </div>
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
            <span>
              <span className="inline-block w-px h-3 bg-[#CBD5E1] mr-1 align-middle" />
              Pace marker
            </span>
            <span className="ml-auto flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: paceDotColor }} />
              <span style={{ color: paceDotColor }}>
                {paceRatio >= 1.05 ? 'Ahead of pace' : paceRatio >= 0.85 ? 'On track' : paceRatio >= 0.6 ? 'Slightly behind' : 'Behind pace'}
              </span>
            </span>
          </div>
        </div>

        {/* ── 4 KPI CARDS ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-4">
          <KpiCard
            label="Demos Booked"
            value={demosBooked}
            subtitle={`Target: ${target} this month`}
            accentColor="#1A56DB"
          />
          <KpiCard
            label="Active Leads"
            value={activeLeads}
            subtitle="In your SDR queue"
            accentColor="#7C3AED"
          />
          <KpiCard
            label="Overdue Follow-ups"
            value={overdueFollowups}
            subtitle={overdueFollowups > 0 ? 'Needs action today' : 'Queue is clear'}
            accentColor={overdueFollowups > 0 ? '#EF4444' : '#059669'}
          />
          <KpiCard
            label="Pending Reschedule"
            value={pendingReschedule}
            subtitle={pendingReschedule > 0 ? 'No-show demos to reschedule' : 'No pending reschedules'}
            accentColor={pendingReschedule > 0 ? '#EF4444' : '#059669'}
          />
        </div>

        {/* ── QUICK ACTIONS ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4">
          <a
            href="/sdr/leads"
            className="group bg-white rounded-2xl border border-[#E2E8F0] p-5 hover:border-[#CBD5E1] transition-all duration-150"
            style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.06)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-label text-[#64748B]">My Leads</p>
              <div className="w-7 h-7 rounded-lg bg-[#EFF6FF] flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-[#1A56DB]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 0 2-2h2a2 2 0 0 0 2 2" />
                </svg>
              </div>
            </div>
            <p className="text-[13px] text-[#374151]">
              <span className="font-semibold text-[#0F172A]">{activeLeads}</span> leads in your queue
            </p>
            <p className="text-[11px] text-[#94A3B8] mt-1.5 group-hover:text-[#64748B] transition-colors">
              Open workspace ↗
            </p>
          </a>

          <a
            href="/sdr/followups"
            className="group bg-white rounded-2xl border border-[#E2E8F0] p-5 hover:border-[#CBD5E1] transition-all duration-150"
            style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.06)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-label text-[#64748B]">Follow-ups</p>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${overdueFollowups > 0 ? 'bg-red-50' : 'bg-[#F1FDF7]'}`}>
                <svg className={`w-3.5 h-3.5 ${overdueFollowups > 0 ? 'text-[#EF4444]' : 'text-[#059669]'}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </div>
            </div>
            <p className="text-[13px] text-[#374151]">
              <span className={`font-semibold ${overdueFollowups > 0 ? 'text-[#EF4444]' : 'text-[#059669]'}`}>
                {overdueFollowups}
              </span>{' '}
              {overdueFollowups === 1 ? 'overdue' : 'overdue'}
            </p>
            <p className="text-[11px] text-[#94A3B8] mt-1.5 group-hover:text-[#64748B] transition-colors">
              Open follow-up queue ↗
            </p>
          </a>
        </div>

      </div>
    </div>
  )
}
