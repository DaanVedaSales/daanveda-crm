import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TopBar from '@/components/layout/TopBar'
import { formatCurrency, formatDate } from '@/lib/utils'

export default async function PastContextPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('id').eq('auth_id', user.id).single()

  const { data: closedDeals } = await supabase
    .from('deals')
    .select('*, organization:organizations(name, location), demo:demos(sdr_summary, sdr:users!demos_sdr_id_fkey(name))')
    .eq('closer_id', profile!.id)
    .in('stage', ['won', 'lost', 'ghosted', 'converted'])
    .order('date_won_lost', { ascending: false })

  const won = closedDeals?.filter(d => d.stage === 'won') ?? []
  const lost = closedDeals?.filter(d => d.stage === 'lost') ?? []
  const ghosted = closedDeals?.filter(d => d.stage === 'ghosted') ?? []

  const totalRevenue = won.reduce((s, d) => s + (d.deal_value ?? 0), 0)
  const winRate = closedDeals?.length
    ? Math.round((won.length / closedDeals.length) * 100)
    : 0

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title="Past Context" subtitle={`${won.length} won · ${lost.length} lost · ${ghosted.length} ghosted`} />
      <div className="flex-1 p-6 space-y-5">

        {/* Summary KPIs */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-sm relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl bg-[#059669]" />
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#64748B] pl-1">Total Won</p>
            <p className="text-2xl font-bold text-[#0F172A] pl-1 mt-1">{formatCurrency(totalRevenue)}</p>
            <p className="text-xs text-[#94A3B8] pl-1">{won.length} deals</p>
          </div>
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-sm relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl bg-[#1A56DB]" />
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#64748B] pl-1">Win Rate</p>
            <p className="text-2xl font-bold text-[#0F172A] pl-1 mt-1">{winRate}%</p>
            <p className="text-xs text-[#94A3B8] pl-1">{closedDeals?.length} total closed</p>
          </div>
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-sm relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl bg-[#EF4444]" />
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#64748B] pl-1">Lost / Ghosted</p>
            <p className="text-2xl font-bold text-[#0F172A] pl-1 mt-1">{lost.length + ghosted.length}</p>
            <p className="text-xs text-[#94A3B8] pl-1">closed without revenue</p>
          </div>
        </div>

        {/* All closed deals table */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[#F1F5F9]">
            <h2 className="text-sm font-semibold text-[#0F172A]">All Closed Deals</h2>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="bg-[#F1F5F9]">
              <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Organization</th>
              <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Outcome</th>
              <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Value</th>
              <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Sales Cycle</th>
              <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Date</th>
              <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Loss Reason</th>
            </tr></thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {closedDeals?.map((d: any) => (
                <tr key={d.id} className="hover:bg-[#F8FAFC]">
                  <td className="px-5 py-3 font-medium text-[#0F172A]">{d.organization?.name}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      d.stage === 'won' ? 'bg-green-50 text-green-700'
                      : d.stage === 'lost' ? 'bg-red-50 text-red-600'
                      : 'bg-slate-100 text-slate-500'
                    }`}>{d.stage.toUpperCase()}</span>
                  </td>
                  <td className="px-5 py-3 text-[#0F172A]">{d.deal_value ? formatCurrency(d.deal_value) : '—'}</td>
                  <td className="px-5 py-3 text-[#64748B]">{d.sales_cycle_days != null ? `${d.sales_cycle_days} days` : '—'}</td>
                  <td className="px-5 py-3 text-[#64748B] text-xs">{formatDate(d.date_won_lost)}</td>
                  <td className="px-5 py-3 text-xs text-[#94A3B8]">{d.loss_reason ?? '—'}</td>
                </tr>
              ))}
              {!closedDeals?.length && (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-[#94A3B8] text-sm">No closed deals yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  )
}
