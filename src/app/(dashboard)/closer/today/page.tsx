import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TopBar from '@/components/layout/TopBar'
import { formatDateTime, formatDate } from '@/lib/utils'

export default async function TodayPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('id').eq('auth_id', user.id).single()
  const today = new Date().toISOString().split('T')[0]

  const [demosRes, followupsRes] = await Promise.all([
    supabase.from('demos')
      .select('*, lead:leads(id, org_id), organization:organizations(name, location), sdr:users!demos_sdr_id_fkey(name)')
      .eq('closer_id', profile!.id)
      .gte('demo_date', `${today}T00:00:00`)
      .lte('demo_date', `${today}T23:59:59`)
      .order('demo_date', { ascending: true }),
    supabase.from('deals')
      .select('*, organization:organizations(name)')
      .eq('closer_id', profile!.id)
      .lte('next_follow_up', today)
      .not('stage', 'in', '("won","lost","ghosted","converted")')
      .order('next_follow_up', { ascending: true }),
  ])

  const demos = demosRes.data ?? []
  const followups = followupsRes.data ?? []

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title="Today's Actions" subtitle={`${demos.length} demos · ${followups.length} follow-ups`} />
      <div className="flex-1 p-6 space-y-6">

        {/* Demos today */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-[#64748B] mb-3">Today's Demos ({demos.length})</h2>
          {demos.length === 0 ? (
            <p className="text-sm text-[#94A3B8]">No demos scheduled today.</p>
          ) : (
            <div className="space-y-3">
              {demos.map((d: any) => (
                <div key={d.id} className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-[#0F172A]">{d.organization?.name}</p>
                      <p className="text-xs text-[#64748B] mt-0.5">{d.organization?.location}</p>
                    </div>
                    <span className="text-sm font-bold text-[#1A56DB]">{formatDateTime(d.demo_date)}</span>
                  </div>
                  <div className="mt-3 p-3 bg-[#F8FAFC] rounded-lg">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8] mb-1">SDR Summary (read-only)</p>
                    <p className="text-xs text-[#0F172A]">{d.sdr_summary}</p>
                    <p className="text-[10px] text-[#94A3B8] mt-1">Booked by: {d.sdr?.name}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Follow-ups due */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-[#64748B] mb-3">
            Follow-ups Due ({followups.length})
          </h2>
          {followups.length === 0 ? (
            <p className="text-sm text-[#94A3B8]">No follow-ups due today.</p>
          ) : (
            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="bg-[#F1F5F9]">
                  <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Organization</th>
                  <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Stage</th>
                  <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Due</th>
                </tr></thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {followups.map((f: any) => (
                    <tr key={f.id} className="hover:bg-[#F8FAFC]">
                      <td className="px-5 py-3 font-medium text-[#0F172A]">{f.organization?.name}</td>
                      <td className="px-5 py-3 text-[#64748B] capitalize">{f.stage?.replace('_', ' ')}</td>
                      <td className="px-5 py-3 text-[#EF4444] font-medium">{formatDate(f.next_follow_up)}</td>
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
