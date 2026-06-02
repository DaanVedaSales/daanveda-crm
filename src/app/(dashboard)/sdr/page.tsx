import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TopBar from '@/components/layout/TopBar'
import KpiCard from '@/components/dashboard/KpiCard'
import { getWorkingDaysElapsed, getNowIST } from '@/lib/utils'

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

  // Use IST for all date calculations — server runs UTC, business operates in IST (UTC+5:30)
  const now         = getNowIST()
  const month       = now.getMonth() + 1
  const year        = now.getFullYear()
  const daysElapsed = getWorkingDaysElapsed(year, month, now)
  const monthStart  = `${year}-${String(month).padStart(2, '0')}-01`
  const today       = `${year}-${String(month).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  // Fetch demos with IDs so we can run quality + pipeline queries downstream
  const [demosRes, leadsRes, followupsRes, noShowRes] = await Promise.all([
    supabase.from('demos').select('id, lead_id').eq('sdr_id', profile.id).eq('is_deleted', false).gte('created_at', monthStart),
    supabase.from('leads').select('id', { count: 'exact', head: true }).eq('assigned_to', profile.id).eq('phase', 'sdr'),
    supabase.from('leads').select('id', { count: 'exact', head: true }).eq('assigned_to', profile.id)
      .lte('follow_up_date', today).in('status', ['call_again', 'follow_up']),
    supabase.from('leads').select('id', { count: 'exact', head: true }).eq('assigned_to', profile.id)
      .eq('status', 'no_show').eq('is_deleted', false),
  ])

  const demosThisMonth    = (demosRes.data ?? []) as { id: string; lead_id: string }[]
  const demosBooked       = demosThisMonth.length
  const demoIds           = demosThisMonth.map(d => d.id)
  const demoLeadIds       = demosThisMonth.map(d => d.lead_id).filter(Boolean)
  const activeLeads       = leadsRes.count ?? 0
  const overdueFollowups  = followupsRes.count ?? 0
  const pendingReschedule = noShowRes.count ?? 0
  const target            = profile.monthly_demo_target ?? 0

  // ── Quality + pipeline metrics ────────────────────────────────────────────
  // Outreach activity count (for cold → demo %)
  const outreachCount = (await supabase
    .from('activities')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', profile.id)
    .in('activity_type', ['call', 'email', 'whatsapp', 'linkedin'])
    .gte('created_at', monthStart)
  ).count ?? 0

  let noShowCount = 0
  let unqualifiedCount = 0
  let pipelineDeals: { id: string; stage: string; deal_value: number | null; organization: { name: string } | null }[] = []

  if (demoIds.length > 0) {
    // Unqualified count + pipeline deals run in parallel (both need demoIds)
    const [unqualRes, pdRes] = await Promise.all([
      supabase.from('deals')
        .select('id', { count: 'exact', head: true })
        .in('demo_id', demoIds)
        .eq('stage', 'unqualified'),
      supabase.from('deals')
        .select('id, stage, deal_value, organization:organizations(name)')
        .in('demo_id', demoIds)
        .in('stage', ['won', 'negotiation'])
        .eq('is_deleted', false),
    ])
    unqualifiedCount = unqualRes.count ?? 0
    pipelineDeals    = (pdRes.data ?? []) as any[]
  }

  if (demoLeadIds.length > 0) {
    // No-show events via immutable activity log (permanent even after reschedule)
    noShowCount = (await supabase
      .from('activities')
      .select('id', { count: 'exact', head: true })
      .in('lead_id', demoLeadIds)
      .eq('new_value', 'demo_no_show')
      .gte('created_at', monthStart)
    ).count ?? 0
  }

  // ── Derived quality metrics (only meaningful with ≥ 3 demos) ─────────────
  const noShowPct      = demosBooked >= 3 ? Math.round((noShowCount / demosBooked) * 100) : null
  const unqualifiedPct = demosBooked >= 3 ? Math.round((unqualifiedCount / demosBooked) * 100) : null
  // Cold→Demo only meaningful when logged outreach ≥ demos booked (ratio >100% = SDR not logging calls)
  const coldToDemoPct = (outreachCount > 0 && outreachCount >= demosBooked)
    ? Math.round((demosBooked / outreachCount) * 100)
    : null

  const wonDeals         = pipelineDeals.filter(d => d.stage === 'won')
  const negotiationDeals = pipelineDeals.filter(d => d.stage === 'negotiation')

  // ── SDR commission: flat per-won-deal (₹200 if <₹1L, ₹500 if ≥₹1L — no multiplier) ──
  const sdrCommission = wonDeals.reduce((total: number, d: any) => {
    return total + ((d.deal_value ?? 0) >= 100000 ? 500 : 200)
  }, 0)

  // ── Pace calculations ─────────────────────────────────────────────────────
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
                <span className="text-[13px] font-semibold" style={{ color: paceColor }}>
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
            subtitle={pendingReschedule > 0 ? 'No-show demos awaiting reschedule' : 'No pending reschedules'}
            accentColor={pendingReschedule > 0 ? '#EF4444' : '#059669'}
          />
        </div>

        {/* ── DEMO QUALITY SIGNALS ─────────────────────────────────────────── */}
        {demosBooked >= 3 && (
          <div
            className="bg-white rounded-2xl border border-[#E2E8F0] px-6 py-5"
            style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.06)' }}
          >
            <p className="text-label text-[#94A3B8] mb-4">Demo Quality Signals</p>
            <div className="grid grid-cols-3 gap-6">
              <div>
                <p className="text-[11px] text-[#64748B] mb-1.5">No-show Rate</p>
                <p
                  className="text-[1.75rem] font-bold leading-none"
                  style={{ color: noShowPct !== null ? (noShowPct > 20 ? '#EF4444' : noShowPct > 10 ? '#F59E0B' : '#059669') : '#94A3B8' }}
                >
                  {noShowPct !== null ? `${noShowPct}%` : '—'}
                </p>
                <p className="text-[10px] text-[#94A3B8] mt-1.5">{noShowCount} events this month</p>
              </div>
              <div className="border-l border-[#F1F5F9] pl-6">
                <p className="text-[11px] text-[#64748B] mb-1.5">Unqualified Rate</p>
                <p
                  className="text-[1.75rem] font-bold leading-none"
                  style={{ color: unqualifiedPct !== null ? (unqualifiedPct > 30 ? '#EF4444' : unqualifiedPct > 15 ? '#F59E0B' : '#059669') : '#94A3B8' }}
                >
                  {unqualifiedPct !== null ? `${unqualifiedPct}%` : '—'}
                </p>
                <p className="text-[10px] text-[#94A3B8] mt-1.5">{unqualifiedCount} marked by closer</p>
              </div>
              <div className="border-l border-[#F1F5F9] pl-6">
                <p className="text-[11px] text-[#64748B] mb-1.5">Cold Call → Demo</p>
                <p className="text-[1.75rem] font-bold leading-none text-[#1A56DB]">
                  {coldToDemoPct !== null ? `${coldToDemoPct}%` : '—'}
                </p>
                <p className="text-[10px] text-[#94A3B8] mt-1.5">
                  {coldToDemoPct !== null
                    ? `${outreachCount} outreach activities`
                    : outreachCount === 0
                    ? 'No outreach logged this month'
                    : 'Log more outreach to activate'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── PIPELINE FROM YOUR DEMOS ─────────────────────────────────────── */}
        {pipelineDeals.length > 0 && (
          <div
            className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden"
            style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.06)' }}
          >
            <div className="px-5 py-4 border-b border-[#F1F5F9] flex items-center justify-between">
              <div>
                <p className="text-label text-[#94A3B8]">Pipeline from Your Demos</p>
                <p className="text-[13px] font-semibold text-[#0F172A] mt-0.5">
                  {pipelineDeals.length} {pipelineDeals.length === 1 ? 'deal' : 'deals'} active
                </p>
              </div>
              {sdrCommission > 0 && (
                <div className="text-right">
                  <p className="text-[10px] text-[#94A3B8] mb-0.5">Est. commission this month</p>
                  <p className="text-[1.125rem] font-bold text-[#059669]">
                    ₹{sdrCommission.toLocaleString('en-IN')}
                  </p>
                </div>
              )}
            </div>

            {negotiationDeals.length > 0 && (
              <div className="px-5 py-3.5 border-b border-[#F1F5F9]">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#F59E0B] mb-2.5">
                  In Negotiation · {negotiationDeals.length}
                </p>
                <div className="space-y-2">
                  {negotiationDeals.map((d: any) => (
                    <div key={d.id} className="flex items-center justify-between">
                      <p className="text-[13px] text-[#374151]">{d.organization?.name ?? '—'}</p>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                        Negotiation
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {wonDeals.length > 0 && (
              <div className="px-5 py-3.5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#059669] mb-2.5">
                  Won This Month · {wonDeals.length}
                </p>
                <div className="space-y-2">
                  {wonDeals.map((d: any) => (
                    <div key={d.id} className="flex items-center justify-between">
                      <p className="text-[13px] text-[#374151]">{d.organization?.name ?? '—'}</p>
                      <div className="flex items-center gap-2.5">
                        {d.deal_value && (
                          <span className="text-[11px] text-[#94A3B8]">
                            ₹{(d.deal_value / 100000).toFixed(1)}L deal
                          </span>
                        )}
                        <span className="text-[11px] font-semibold text-[#059669]">
                          {(d.deal_value ?? 0) >= 100000 ? '+₹500' : '+₹200'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

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
              overdue
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
