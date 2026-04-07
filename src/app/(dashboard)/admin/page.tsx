import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TopBar from '@/components/layout/TopBar'
import KpiCard from '@/components/dashboard/KpiCard'
import { formatCurrency } from '@/lib/utils'

export default async function AdminDashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`

  const [usersRes, leadsRes, demosRes, dealsRes, teamRes] = await Promise.all([
    supabase.from('users').select('id, name, role, monthly_demo_target, monthly_revenue_target, is_active'),
    supabase.from('leads').select('id, status, phase', { count: 'exact' }),
    supabase.from('demos').select('id, sdr_id, status').gte('created_at', monthStart),
    supabase.from('deals').select('id, closer_id, stage, deal_value').gte('created_at', monthStart),
    supabase.from('users').select('id, name, role, monthly_demo_target, monthly_revenue_target').eq('is_active', true),
  ])

  type User = { id: string; name: string; role: string; monthly_demo_target: number; monthly_revenue_target: number; is_active: boolean }
  type Lead = { id: string; status: string; phase: string }
  type Demo = { id: string; sdr_id: string; status: string }
  type Deal = { id: string; closer_id: string; stage: string; deal_value: number | null }

  const activeUsers = ((usersRes.data ?? []) as User[]).filter(u => u.is_active)
  const sdrs = activeUsers.filter(u => u.role === 'sdr')
  const closers = activeUsers.filter(u => u.role === 'closer')
  const totalLeads = leadsRes.count ?? 0
  const unassignedLeads = ((leadsRes.data ?? []) as Lead[]).filter(l => l.phase === 'sdr' && l.status === 'new').length
  const demosThisMonth = ((demosRes.data ?? []) as Demo[]).length
  const wonDeals = ((dealsRes.data ?? []) as Deal[]).filter(d => d.stage === 'won')
  const revenueThisMonth = wonDeals.reduce((sum, d) => sum + (d.deal_value ?? 0), 0)

  // SDR performance table
  const sdrPerformance = await Promise.all(
    sdrs.map(async (sdr) => {
      const { count: demos } = await supabase.from('demos')
        .select('id', { count: 'exact', head: true })
        .eq('sdr_id', sdr.id).gte('created_at', monthStart)
      const { count: leads } = await supabase.from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_to', sdr.id).eq('phase', 'sdr')
      const pct = sdr.monthly_demo_target > 0 ? Math.round(((demos ?? 0) / sdr.monthly_demo_target) * 100) : 0
      return { ...sdr, demos: demos ?? 0, leads: leads ?? 0, pct }
    })
  )

  // Sort by risk (lowest % first — PIP risk)
  sdrPerformance.sort((a, b) => a.pct - b.pct)

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title="Admin Dashboard" subtitle={`${now.toLocaleString('default', { month: 'long' })} ${year} · Team overview`} />

      <div className="flex-1 p-6 space-y-6">

        {/* KPIs */}
        <div className="grid grid-cols-4 gap-4">
          <KpiCard label="Total Leads" value={totalLeads} subtitle={`${unassignedLeads} unassigned`} accentColor="#1A56DB" />
          <KpiCard label="Demos Booked" value={demosThisMonth} subtitle="This month" accentColor="#7C3AED" />
          <KpiCard label="Revenue Won" value={formatCurrency(revenueThisMonth)} subtitle="This month" accentColor="#059669" />
          <KpiCard label="Active Team" value={activeUsers.length} subtitle={`${sdrs.length} SDRs · ${closers.length} Closers`} accentColor="#0891B2" />
        </div>

        {/* Team Performance Table (sorted by risk — PIP candidates first) */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[#F1F5F9]">
            <h2 className="text-sm font-semibold text-[#0F172A]">SDR Performance</h2>
            <p className="text-xs text-[#94A3B8] mt-0.5">Sorted by achievement % · lowest first (PIP risk)</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F1F5F9]">
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">SDR</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Demos</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Target</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Achievement</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Leads</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {sdrPerformance.map(sdr => {
                const isPipRisk = sdr.pct < 60
                const isBehind = sdr.pct < 85 && sdr.pct >= 60
                return (
                  <tr key={sdr.id} className={`hover:bg-[#F8FAFC] transition-colors ${isPipRisk ? 'bg-red-50/30' : ''}`}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-[#1A56DB]/10 flex items-center justify-center">
                          <span className="text-[#1A56DB] text-xs font-semibold">{sdr.name.charAt(0)}</span>
                        </div>
                        <span className="font-medium text-[#0F172A]">{sdr.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-[#0F172A]">{sdr.demos}</td>
                    <td className="px-5 py-3.5 text-[#64748B]">{sdr.monthly_demo_target}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(sdr.pct, 100)}%`,
                              backgroundColor: isPipRisk ? '#EF4444' : isBehind ? '#F59E0B' : '#059669'
                            }}
                          />
                        </div>
                        <span className={`text-xs font-semibold ${isPipRisk ? 'text-[#EF4444]' : isBehind ? 'text-[#F59E0B]' : 'text-[#059669]'}`}>
                          {sdr.pct}%
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-[#64748B]">{sdr.leads}</td>
                    <td className="px-5 py-3.5">
                      {isPipRisk ? (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-red-500 text-white">PIP RISK</span>
                      ) : isBehind ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border border-amber-300 text-amber-700">Behind</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border border-green-300 text-green-700">On Track</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  )
}
