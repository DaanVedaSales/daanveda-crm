'use client'

import { useState, useEffect } from 'react'
import TopBar from '@/components/layout/TopBar'
import { LEAD_STATUS_LABELS, LEAD_STATUS_COLORS } from '@/lib/constants'
import type { LeadStatus } from '@/types/database'

export default function AdminLeadPoolPage() {
  const [leads, setLeads] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [assigning, setAssigning] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'unassigned'>('unassigned')

  useEffect(() => {
    Promise.all([fetch('/api/leads').then(r => r.json()), fetch('/api/users').then(r => r.json())])
      .then(([l, u]) => { setLeads(l ?? []); setUsers((u ?? []).filter((u: any) => u.role === 'sdr' && u.is_active)); setLoading(false) })
  }, [])

  const filtered = filter === 'unassigned'
    ? leads.filter(l => !l.assigned_to && l.phase === 'sdr')
    : leads

  async function assignLead(leadId: string, toUserId: string) {
    setAssigning(leadId)
    await fetch(`/api/leads/${leadId}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to_user_id: toUserId, reason: 'Admin assignment' }),
    })
    const res = await fetch('/api/leads')
    setLeads(await res.json())
    setAssigning(null)
  }

  if (loading) return <div className="flex-1 flex items-center justify-center"><div className="w-6 h-6 border-2 border-[#1A56DB] border-t-transparent rounded-full animate-spin" /></div>

  const unassignedCount = leads.filter(l => !l.assigned_to && l.phase === 'sdr').length

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title="Lead Pool" subtitle={`${unassignedCount} unassigned · ${leads.length} total`} />
      <div className="flex-1 p-6 space-y-4">
        <div className="flex gap-2">
          {(['unassigned', 'all'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${filter === f ? 'bg-[#1A56DB] text-white' : 'bg-white border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]'}`}>
              {f === 'unassigned' ? `Unassigned (${unassignedCount})` : `All (${leads.length})`}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-[#F1F5F9]">
              <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Organization</th>
              <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Location</th>
              <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">SQL Score</th>
              <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Status</th>
              <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Assign To</th>
            </tr></thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {filtered.map(l => (
                <tr key={l.id} className="hover:bg-[#F8FAFC]">
                  <td className="px-5 py-3 font-medium text-[#0F172A]">{l.organization?.name ?? '—'}</td>
                  <td className="px-5 py-3 text-[#64748B]">{l.organization?.location ?? '—'}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                      (l.organization?.sql_score ?? 0) >= 6 ? 'bg-green-50 text-green-700'
                      : (l.organization?.sql_score ?? 0) >= 4 ? 'bg-amber-50 text-amber-700'
                      : 'bg-slate-100 text-slate-500'
                    }`}>{l.organization?.sql_score ?? 0}/8</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${LEAD_STATUS_COLORS[l.status as LeadStatus]}`}>
                      {LEAD_STATUS_LABELS[l.status as LeadStatus]}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {l.assigned_to ? (
                      <span className="text-xs text-[#64748B]">{l.assignee?.name ?? 'Assigned'}</span>
                    ) : (
                      <select
                        onChange={e => e.target.value && assignLead(l.id, e.target.value)}
                        disabled={assigning === l.id}
                        defaultValue=""
                        className="px-2 py-1 text-xs border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20 disabled:opacity-60"
                      >
                        <option value="">Assign to SDR...</option>
                        {users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-[#94A3B8] text-sm">No leads in this view.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
