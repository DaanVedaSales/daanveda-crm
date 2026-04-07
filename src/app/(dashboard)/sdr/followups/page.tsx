import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TopBar from '@/components/layout/TopBar'
import { formatDate } from '@/lib/utils'

// TODO: Build full follow-up queue with overdue/today/upcoming tabs
// Reference: CLAUDE.md file structure → sdr/followups/page.tsx
// Use: supabase.from('leads').select(...).lte('follow_up_date', today)

export default async function FollowupsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('id').eq('auth_id', user.id).single()
  const today = new Date().toISOString().split('T')[0]

  const { data: overdue } = await supabase
    .from('leads')
    .select('*, organization:organizations(name, location)')
    .eq('assigned_to', profile!.id)
    .lte('follow_up_date', today)
    .in('status', ['call_again', 'follow_up', 'contacted'])
    .order('follow_up_date', { ascending: true })

  const { data: upcoming } = await supabase
    .from('leads')
    .select('*, organization:organizations(name, location)')
    .eq('assigned_to', profile!.id)
    .gt('follow_up_date', today)
    .in('status', ['call_again', 'follow_up', 'contacted'])
    .order('follow_up_date', { ascending: true })

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title="Follow-up Queue" subtitle={`${overdue?.length ?? 0} overdue · ${upcoming?.length ?? 0} upcoming`} />
      <div className="flex-1 p-6 space-y-5">

        {(overdue?.length ?? 0) > 0 && (
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-[#EF4444] mb-3">Overdue ({overdue?.length})</h2>
            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="bg-[#F1F5F9]">
                  <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Organization</th>
                  <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Status</th>
                  <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Follow-up Date</th>
                </tr></thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {overdue?.map((l: any) => (
                    <tr key={l.id} className="hover:bg-red-50/30">
                      <td className="px-5 py-3 font-medium text-[#0F172A]">{l.organization?.name}</td>
                      <td className="px-5 py-3 text-[#64748B] capitalize">{l.status?.replace('_', ' ')}</td>
                      <td className="px-5 py-3 text-[#EF4444] font-medium">{formatDate(l.follow_up_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {(upcoming?.length ?? 0) > 0 && (
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-[#64748B] mb-3">Upcoming ({upcoming?.length})</h2>
            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="bg-[#F1F5F9]">
                  <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Organization</th>
                  <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Status</th>
                  <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Follow-up Date</th>
                </tr></thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {upcoming?.map((l: any) => (
                    <tr key={l.id} className="hover:bg-[#F8FAFC]">
                      <td className="px-5 py-3 font-medium text-[#0F172A]">{l.organization?.name}</td>
                      <td className="px-5 py-3 text-[#64748B] capitalize">{l.status?.replace('_', ' ')}</td>
                      <td className="px-5 py-3 text-[#0F172A]">{formatDate(l.follow_up_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!overdue?.length && !upcoming?.length && (
          <div className="flex flex-col items-center justify-center py-20 text-[#94A3B8]">
            <p className="text-lg">🎉 All clear!</p>
            <p className="text-sm mt-1">No follow-ups pending today.</p>
          </div>
        )}
      </div>
    </div>
  )
}
