import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TopBar from '@/components/layout/TopBar'
import { formatCurrency, formatDate } from '@/lib/utils'

export default async function DealHistoryPage() {
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

  // won + converted are treated identically — both represent a closed deal
  const wonDeals = closedDeals?.filter(d => d.stage === 'won' || d.stage === 'converted') ?? []
  const lost = closedDeals?.filter(d => d.stage === 'lost') ?? []
  const ghosted = closedDeals?.filter(d => d.stage === 'ghosted') ?? []

  const totalRevenue = wonDeals.reduce((s, d) => s + (d.deal_value ?? 0), 0)
  const winRate = closedDeals?.length
    ? Math.round((wonDeals.length / closedDeals.length) * 100)
    : 0

  return (
    <div className="flex-1 flex flex-col bg-[#F8FAFC]">
      <TopBar
        title="Deal History"
        subtitle={`${wonDeals.length} won · ${lost.length} lost · ${ghosted.length} ghosted`}
      />
      <div className="flex-1 p-6 space-y-5 animate-in-page">

        {/* Summary KPIs */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Revenue Won', value: formatCurrency(totalRevenue), sub: `${wonDeals.length} deals`, color: '#059669' },
            { label: 'Win Rate', value: `${winRate}%`, sub: `${closedDeals?.length ?? 0} total closed`, color: '#1A56DB' },
            { label: 'Lost / Ghosted', value: String(lost.length + ghosted.length), sub: 'closed without revenue', color: '#EF4444' },
          ].map(kpi => (
            <div
              key={kpi.label}
              className="relative bg-white rounded-2xl border border-[#E2E8F0] p-5 overflow-hidden"
              style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.06)' }}
            >
              <div
                className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full"
                style={{ backgroundColor: kpi.color }}
              />
              <div className="pl-3">
                <p className="text-label text-[#64748B] mb-2.5">{kpi.label}</p>
                <p
                  className="text-[1.625rem] font-bold text-[#0F172A] leading-none mb-1.5"
                  style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}
                >
                  {kpi.value}
                </p>
                <p className="text-[11px] text-[#94A3B8]">{kpi.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* All closed deals table */}
        <div
          className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden"
          style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.06)' }}
        >
          <div className="px-5 py-4 border-b border-[#F1F5F9]">
            <p className="text-label text-[#64748B]">All Closed Deals</p>
            <p className="text-[13px] font-semibold text-[#0F172A] mt-0.5">
              {closedDeals?.length ?? 0} {(closedDeals?.length ?? 0) === 1 ? 'deal' : 'deals'} closed
            </p>
          </div>

          {!closedDeals?.length ? (
            <div className="p-12 text-center">
              <div className="w-10 h-10 rounded-xl bg-[#F1F5F9] flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5 text-[#94A3B8]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
                </svg>
              </div>
              <p className="text-[13px] font-medium text-[#374151]">No closed deals yet</p>
              <p className="text-[11px] text-[#94A3B8] mt-1">Won, lost, and ghosted deals will appear here</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                    {['Organization', 'Outcome', 'Value', 'Sales Cycle', 'Date', 'Loss Reason'].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-label text-[#94A3B8]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {closedDeals.map((d: any) => (
                    <tr key={d.id} className="hover:bg-[#F8FAFC] transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="text-[13px] font-medium text-[#0F172A]">{d.organization?.name}</p>
                        {d.organization?.location && (
                          <p className="text-[11px] text-[#94A3B8] mt-0.5">{d.organization.location}</p>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                          (d.stage === 'won' || d.stage === 'converted')
                            ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#059669]'
                            : d.stage === 'lost'
                            ? 'bg-red-50 border-red-200 text-[#EF4444]'
                            : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#94A3B8]'
                        }`}>
                          {(d.stage === 'won' || d.stage === 'converted') ? 'Won' : d.stage.charAt(0).toUpperCase() + d.stage.slice(1)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className="text-[13px] font-semibold text-[#0F172A]"
                          style={{ fontVariantNumeric: 'tabular-nums' }}
                        >
                          {d.deal_value ? formatCurrency(d.deal_value) : '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-[13px] text-[#64748B]">
                        {d.sales_cycle_days != null ? `${d.sales_cycle_days}d` : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-[12px] text-[#64748B]">
                        {formatDate(d.date_won_lost)}
                      </td>
                      <td className="px-5 py-3.5 text-[12px] text-[#94A3B8] max-w-[160px] truncate">
                        {d.loss_reason ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
