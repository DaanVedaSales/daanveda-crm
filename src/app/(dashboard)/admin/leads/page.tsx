'use client'

import { useState, useEffect } from 'react'
import TopBar from '@/components/layout/TopBar'
import { LEAD_STATUS_LABELS, LEAD_STATUS_COLORS } from '@/lib/constants'
import type { LeadStatus } from '@/types/database'
import { Trash2 } from 'lucide-react'

export default function AdminLeadPoolPage() {
  const [leads, setLeads] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [assigning, setAssigning] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'unassigned'>('unassigned')
  const [confirmDelete, setConfirmDelete] = useState<{ orgId: string; orgName: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    const [l, u] = await Promise.all([fetch('/api/leads').then(r => r.json()), fetch('/api/users').then(r => r.json())])
    setLeads(l ?? [])
    setUsers((u ?? []).filter((u: any) => u.role === 'sdr' && u.is_active))
    setLoading(false)
  }

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

  async function deleteOrg() {
    if (!confirmDelete) return
    setDeleting(true)
    const res = await fetch(`/api/organizations/${confirmDelete.orgId}`, { method: 'DELETE' })
    if (res.ok) {
      setLeads(prev => prev.filter(l => l.organization?.id !== confirmDelete.orgId))
    } else {
      const data = await res.json()
      alert(data.error ?? 'Delete failed. Please try again.')
    }
    setDeleting(false)
    setConfirmDelete(null)
  }

  // Get SQL label — use sql_score_label if present, fallback gracefully
  function getSqlLabel(org: any): string {
    if (org?.sql_score_label) return org.sql_score_label
    return '—'
  }

  if (loading) return <div className="flex-1 flex items-center justify-center"><div className="w-6 h-6 border-2 border-[#1A56DB] border-t-transparent rounded-full animate-spin" /></div>

  const unassignedCount = leads.filter(l => !l.assigned_to && l.phase === 'sdr').length

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title="Lead Pool" subtitle={`${unassignedCount} unassigned · ${leads.length} total`} />
      <div className="flex-1 p-6 space-y-4 overflow-y-auto">
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
            <thead>
              <tr className="bg-[#F1F5F9]">
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Organization</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Location</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">SQL Score</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Status</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Assigned To</th>
                <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {filtered.map(l => (
                <tr key={l.id} className="hover:bg-[#F8FAFC] group">
                  <td className="px-5 py-3 font-medium text-[#0F172A]">{l.organization?.name ?? '—'}</td>
                  <td className="px-5 py-3 text-[#64748B] text-xs">{l.organization?.location ?? '—'}</td>
                  <td className="px-5 py-3">
                    {getSqlLabel(l.organization) !== '—' ? (
                      <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                        {getSqlLabel(l.organization)}
                      </span>
                    ) : (
                      <span className="text-xs text-[#94A3B8]">—</span>
                    )}
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
                  <td className="px-3 py-3 text-right">
                    <button
                      onClick={() => setConfirmDelete({ orgId: l.organization?.id, orgName: l.organization?.name ?? 'this org' })}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-[#94A3B8] hover:text-red-500 hover:bg-red-50 transition-all"
                      title="Permanently delete from system"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-[#94A3B8] text-sm">No leads in this view.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                <Trash2 className="w-4 h-4 text-red-500" />
              </div>
              <div>
                <h3 className="font-semibold text-[#0F172A]">Permanently delete organisation?</h3>
                <p className="text-sm text-[#64748B] mt-1">
                  <span className="font-medium text-[#0F172A]">{confirmDelete.orgName}</span> and all associated leads, contacts, demos, activities, and deals will be permanently removed. This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={deleteOrg}
                disabled={deleting}
                className="flex-1 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 disabled:opacity-60 transition-colors"
              >
                {deleting ? 'Deleting...' : 'Yes, delete permanently'}
              </button>
              <button
                onClick={() => setConfirmDelete(null)}
                className="py-2 px-4 border border-[#E2E8F0] text-sm text-[#64748B] rounded-lg hover:bg-[#F8FAFC]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
