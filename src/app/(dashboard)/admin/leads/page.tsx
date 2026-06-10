'use client'

import { useState, useEffect, useRef } from 'react'
import TopBar from '@/components/layout/TopBar'
import { LEAD_STATUS_LABELS, LEAD_STATUS_COLORS } from '@/lib/constants'
import type { LeadStatus } from '@/types/database'
import { Trash2, Users, Inbox, CheckCircle2, XCircle, Loader2, MapPin, Search, Ban } from 'lucide-react'

export default function AdminLeadPoolPage() {
  const [leads, setLeads] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [assigning, setAssigning] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'unassigned'>('unassigned')
  const [activeTab,     setActiveTab]     = useState<'pool' | 'claims' | 'returned'>('pool')
  const [confirmDelete, setConfirmDelete] = useState<{ orgId: string; orgName: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [poolSearch, setPoolSearch] = useState('')

  // Bulk select state
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkSdrId, setBulkSdrId] = useState('')
  const [bulkAssigning, setBulkAssigning] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)

  // Drag-select through checkbox column
  const isDraggingSelect = useRef(false)
  const dragSelectMode = useRef<'add' | 'remove'>('add') // whether this drag is adding or removing

  useEffect(() => {
    loadAll()
    // Stop drag on global mouseup
    function onMouseUp() { isDraggingSelect.current = false }
    document.addEventListener('mouseup', onMouseUp)
    return () => document.removeEventListener('mouseup', onMouseUp)
  }, [])

  async function loadAll() {
    const [l, u] = await Promise.all([fetch('/api/leads').then(r => r.json()), fetch('/api/users').then(r => r.json())])
    setLeads(l ?? [])
    setUsers((u ?? []).filter((u: any) => u.role === 'sdr' && u.is_active))
    setLoading(false)
  }

  const filteredByTab = filter === 'unassigned'
    ? leads.filter(l => !l.assigned_to && l.phase === 'sdr')
    : leads
  const poolQuery = poolSearch.trim().toLowerCase()
  const filtered = poolQuery
    ? filteredByTab.filter(l =>
        (l.organization?.name ?? '').toLowerCase().includes(poolQuery) ||
        (l.organization?.location ?? '').toLowerCase().includes(poolQuery))
    : filteredByTab

  // Reset selection when filter changes
  function setFilterAndClear(f: 'all' | 'unassigned') {
    setFilter(f)
    setSelected(new Set())
  }

  // Individual assign
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

  // Bulk assign
  async function handleBulkAssign() {
    if (!bulkSdrId || selected.size === 0) return
    setBulkAssigning(true)
    await Promise.all(
      Array.from(selected).map(leadId =>
        fetch(`/api/leads/${leadId}/assign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to_user_id: bulkSdrId, reason: 'Bulk admin assignment' }),
        })
      )
    )
    setSelected(new Set())
    setBulkSdrId('')
    const res = await fetch('/api/leads')
    setLeads(await res.json())
    setBulkAssigning(false)
  }

  // Bulk HARD delete of the selected leads (admin cleanup) — removes them + their
  // orgs/contacts/activities/demos/deals via /api/leads/bulk-delete.
  async function handleBulkDelete() {
    if (selected.size === 0) return
    setBulkDeleting(true)
    const res = await fetch('/api/leads/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_ids: Array.from(selected) }),
    })
    if (res.ok) {
      setSelected(new Set())
      setConfirmBulkDelete(false)
      const r = await fetch('/api/leads')
      setLeads(await r.json())
    } else {
      const e = await res.json().catch(() => ({}))
      alert(e.error ?? 'Delete failed.')
    }
    setBulkDeleting(false)
  }

  // Checkbox logic
  function toggleSelect(leadId: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(leadId)) next.delete(leadId)
      else next.add(leadId)
      return next
    })
  }

  // Drag-select handlers for the checkbox column
  function handleCheckboxMouseDown(leadId: string, e: React.MouseEvent) {
    e.preventDefault() // prevent text selection
    isDraggingSelect.current = true
    // If currently selected → this drag will remove; otherwise add
    dragSelectMode.current = selected.has(leadId) ? 'remove' : 'add'
    setSelected(prev => {
      const next = new Set(prev)
      dragSelectMode.current === 'remove' ? next.delete(leadId) : next.add(leadId)
      return next
    })
  }

  function handleCheckboxMouseEnter(leadId: string) {
    if (!isDraggingSelect.current) return
    setSelected(prev => {
      const next = new Set(prev)
      dragSelectMode.current === 'remove' ? next.delete(leadId) : next.add(leadId)
      return next
    })
  }

  function toggleSelectAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map((l: any) => l.id)))
    }
  }

  const allSelected = filtered.length > 0 && selected.size === filtered.length
  const someSelected = selected.size > 0 && selected.size < filtered.length

  // Delete org
  async function deleteOrg() {
    if (!confirmDelete) return
    setDeleting(true)
    const res = await fetch(`/api/organizations/${confirmDelete.orgId}`, { method: 'DELETE' })
    if (res.ok) {
      setLeads(prev => prev.filter(l => l.organization?.id !== confirmDelete.orgId))
      setSelected(prev => {
        const next = new Set(prev)
        leads.filter(l => l.organization?.id === confirmDelete.orgId).forEach(l => next.delete(l.id))
        return next
      })
    } else {
      const data = await res.json()
      alert(data.error ?? 'Delete failed. Please try again.')
    }
    setDeleting(false)
    setConfirmDelete(null)
  }

  // Mark an org as banned (do-not-contact) — hides it from SDR & Closer workspaces
  async function banOrg(orgId: string | undefined, orgName: string) {
    if (!orgId) return
    if (!confirm(`Mark "${orgName}" as a banned organisation?\n\nIt will be hidden from all SDR and Closer workspaces and flagged red in org search. You can unban it from Datasets → Banned Organisations.`)) return
    const res = await fetch(`/api/organizations/${orgId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_banned: true }),
    })
    if (res.ok) {
      // Remove this org's leads from the pool view
      setLeads(prev => prev.filter(l => l.organization?.id !== orgId))
      setSelected(prev => {
        const next = new Set(prev)
        leads.filter(l => l.organization?.id === orgId).forEach(l => next.delete(l.id))
        return next
      })
    } else {
      const data = await res.json().catch(() => ({}))
      alert(data.error ?? 'Failed to ban organisation. Please try again.')
    }
  }

  function getSqlLabel(org: any): string {
    return org?.sql_score_label ?? '—'
  }

  if (loading) return <div className="flex-1 flex items-center justify-center"><div className="w-6 h-6 border-2 border-[#1A56DB] border-t-transparent rounded-full animate-spin" /></div>

  const unassignedCount = leads.filter(l => !l.assigned_to && l.phase === 'sdr').length

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <TopBar title="Lead Pool" subtitle={`${unassignedCount} unassigned · ${leads.length} total`} />

      {/* ── Top-level tab bar ───────────────────────────────────────────── */}
      <div className="border-b border-[#E2E8F0] bg-white px-6 flex gap-0 shrink-0">
        {([
          ['pool',     'Lead Pool'],
          ['claims',   'Claims'],
          ['returned', 'Returned'],
        ] as const).map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 text-[13px] font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-[#1A56DB] text-[#1A56DB]'
                : 'border-transparent text-[#64748B] hover:text-[#374151]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Claims tab ──────────────────────────────────────────────────── */}
      {activeTab === 'claims' && <ClaimsSection />}

      {/* ── Returned tab (not interested / dead / ban requests) ─────────── */}
      {activeTab === 'returned' && <ReturnedLeadsSection />}

      {/* ── Lead Pool tab (existing content) ────────────────────────────── */}
      {activeTab === 'pool' && (
      <div className="flex-1 p-6 space-y-4 overflow-y-auto">

        {/* Filter tabs */}
        <div className="flex gap-2">
          {(['unassigned', 'all'] as const).map(f => (
            <button key={f} onClick={() => setFilterAndClear(f)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${filter === f ? 'bg-[#1A56DB] text-white' : 'bg-white border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]'}`}>
              {f === 'unassigned' ? `Unassigned (${unassignedCount})` : `All (${leads.length})`}
            </button>
          ))}
        </div>

        {/* Pool search — pinpoint an organisation to assign, ban, or delete */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8] pointer-events-none" />
          <input
            value={poolSearch}
            onChange={e => setPoolSearch(e.target.value)}
            placeholder="Search the pool by organisation or location…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20"
          />
        </div>

        {/* Bulk assign bar — slides in when rows are selected */}
        {selected.size > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 bg-[#1A56DB] text-white rounded-xl shadow-lg">
            <Users className="w-4 h-4 shrink-0" />
            <span className="text-sm font-medium">{selected.size} lead{selected.size > 1 ? 's' : ''} selected</span>
            <div className="flex-1" />
            <select
              value={bulkSdrId}
              onChange={e => setBulkSdrId(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-lg bg-white text-[#0F172A] border-0 focus:outline-none focus:ring-2 focus:ring-white/40 min-w-[160px]"
            >
              <option value="">Assign to SDR...</option>
              {users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <button
              onClick={handleBulkAssign}
              disabled={!bulkSdrId || bulkAssigning}
              className="px-4 py-1.5 bg-white text-[#1A56DB] text-sm font-semibold rounded-lg hover:bg-blue-50 disabled:opacity-50 transition-colors"
            >
              {bulkAssigning ? 'Assigning...' : 'Assign All'}
            </button>
            {confirmBulkDelete ? (
              <div className="flex items-center gap-1.5">
                <span className="text-[12px]">Delete {selected.size}?</span>
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting}
                  className="px-3 py-1.5 bg-white text-[#EF4444] text-sm font-semibold rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                  title="Permanently delete the selected leads + their orgs/contacts/pipeline"
                >
                  {bulkDeleting ? '...' : 'Yes, delete'}
                </button>
                <button onClick={() => setConfirmBulkDelete(false)} disabled={bulkDeleting} className="text-white/80 hover:text-white text-sm px-1">No</button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmBulkDelete(true)}
                className="px-4 py-1.5 bg-[#EF4444] text-white text-sm font-semibold rounded-lg hover:bg-[#DC2626] transition-colors"
              >
                Delete
              </button>
            )}
            <button
              onClick={() => { setSelected(new Set()); setConfirmBulkDelete(false) }}
              className="text-white/70 hover:text-white text-sm px-2"
            >
              Clear
            </button>
          </div>
        )}

        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F1F5F9]">
                <th className="px-4 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={el => { if (el) el.indeterminate = someSelected }}
                    onChange={toggleSelectAll}
                    className="rounded border-[#CBD5E1] text-[#1A56DB] focus:ring-[#1A56DB]/30 cursor-pointer"
                  />
                </th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Organization</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Location</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">SQL Score</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Status</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Assigned To</th>
                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {filtered.map((l: any) => {
                const isSelected = selected.has(l.id)
                return (
                  <tr key={l.id} className={`hover:bg-[#F8FAFC] group transition-colors ${isSelected ? 'bg-blue-50/50' : ''}`}>
                    <td
                      className="px-4 py-3 cursor-pointer select-none"
                      onMouseDown={e => handleCheckboxMouseDown(l.id, e)}
                      onMouseEnter={() => handleCheckboxMouseEnter(l.id)}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(l.id)}
                        className="rounded border-[#CBD5E1] text-[#1A56DB] focus:ring-[#1A56DB]/30 cursor-pointer pointer-events-none"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-[#0F172A]">{l.organization?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-[#64748B] text-xs">{l.organization?.location ?? '—'}</td>
                    <td className="px-4 py-3">
                      {getSqlLabel(l.organization) !== '—' ? (
                        <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                          {getSqlLabel(l.organization)}
                        </span>
                      ) : (
                        <span className="text-xs text-[#94A3B8]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${LEAD_STATUS_COLORS[l.status as LeadStatus]}`}>
                        {LEAD_STATUS_LABELS[l.status as LeadStatus]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {l.assigned_to ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-[#64748B]">{l.assignee?.name ?? 'Assigned'}</span>
                          <select
                            onChange={e => e.target.value && assignLead(l.id, e.target.value)}
                            disabled={assigning === l.id}
                            defaultValue=""
                            className="px-1.5 py-0.5 text-[10px] border border-[#E2E8F0] rounded text-[#64748B] focus:outline-none focus:ring-1 focus:ring-[#1A56DB]/30 disabled:opacity-60"
                          >
                            <option value="">Reassign...</option>
                            {users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                          </select>
                        </div>
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
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => banOrg(l.organization?.id, l.organization?.name ?? 'this org')}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-[#B91C1C] hover:bg-red-50 transition-colors"
                          title="Mark as banned — hide from SDR & Closer workspaces"
                        >
                          <Ban className="w-3.5 h-3.5" /> Ban
                        </button>
                        <button
                          onClick={() => setConfirmDelete({ orgId: l.organization?.id, orgName: l.organization?.name ?? 'this org' })}
                          className="p-1.5 rounded-lg text-[#94A3B8] hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="Permanently delete from system"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-[#94A3B8] text-sm">No leads in this view.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      )} {/* end pool tab */}

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

// ── Claims Section ──────────────────────────────────────────────────────────

const CLAIM_STATUS_COLORS: Record<string, string> = {
  pending:   'bg-[#FEF3C7] text-[#92400E]',
  approved:  'bg-[#D1FAE5] text-[#065F46]',
  rejected:  'bg-[#FEE2E2] text-[#991B1B]',
  fulfilled: 'bg-[#EFF6FF] text-[#1D4ED8]',
}

function ClaimsSection() {
  const [claimType,    setClaimType]    = useState<'lead_pool' | 'data_enrichment'>('lead_pool')
  const [statusFilter, setStatusFilter] = useState<'pending' | 'all'>('pending')
  const [requests,     setRequests]     = useState<any[]>([])
  const [loading,      setLoading]      = useState(true)
  const [actioning,    setActioning]    = useState<string | null>(null)
  const [notes,        setNotes]        = useState<Record<string, string>>({})

  useEffect(() => { loadRequests() }, [claimType, statusFilter])

  async function loadRequests() {
    setLoading(true)
    const params = new URLSearchParams({ type: claimType })
    if (statusFilter === 'pending') params.set('status', 'pending')
    const res = await fetch(`/api/lead-requests?${params}`)
    const data = await res.json()
    setRequests(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  async function action(id: string, status: 'approved' | 'rejected' | 'fulfilled') {
    setActioning(id)
    const res = await fetch(`/api/lead-requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, admin_note: notes[id]?.trim() || undefined }),
    })
    if (res.ok) {
      await loadRequests()
    } else {
      const d = await res.json()
      alert(d.error ?? 'Action failed')
    }
    setActioning(null)
  }

  const pendingCount = requests.filter(r => r.status === 'pending').length

  return (
    <div className="flex-1 p-6 space-y-4 overflow-y-auto">

      {/* Type + status filter */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2">
          {([
            ['lead_pool',       'Lead Pool Requests'],
            ['data_enrichment', 'Data Enrichment Requests'],
          ] as const).map(([t, lbl]) => (
            <button
              key={t}
              onClick={() => setClaimType(t)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                claimType === t
                  ? 'bg-[#1A56DB] text-white'
                  : 'bg-white border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]'
              }`}
            >
              {lbl}
            </button>
          ))}
        </div>
        <button
          onClick={() => setStatusFilter(f => f === 'pending' ? 'all' : 'pending')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
            statusFilter === 'pending'
              ? 'bg-[#FEF3C7] border-[#FCD34D] text-[#92400E]'
              : 'border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]'
          }`}
        >
          {statusFilter === 'pending' ? `Pending only (${pendingCount})` : 'Showing all'}
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-[#94A3B8]" />
        </div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-xl border border-[#E2E8F0]">
          <Inbox className="w-8 h-8 text-[#CBD5E1] mb-3" />
          <p className="text-sm font-medium text-[#374151]">No {statusFilter === 'pending' ? 'pending ' : ''}requests</p>
          <p className="text-xs text-[#94A3B8] mt-1">
            {claimType === 'lead_pool'
              ? 'SDRs can request assignment to unassigned orgs via org search.'
              : 'SDRs can request data enrichment for orgs not yet in the system.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(req => {
            const orgName  = req.org?.name ?? req.org_name_requested ?? '—'
            const isPending = req.status === 'pending'
            const isActioning = actioning === req.id

            return (
              <div key={req.id} className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-4">
                <div className="flex items-start gap-4">

                  {/* Info */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-semibold text-[#0F172A]">{orgName}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${CLAIM_STATUS_COLORS[req.status] ?? 'bg-[#F1F5F9] text-[#475569]'}`}>
                        {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-x-3 text-[11px] text-[#94A3B8]">
                      <span>From: <span className="text-[#374151] font-medium">{req.sdr?.name ?? '—'}</span></span>
                      {req.org?.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />{req.org.location}
                        </span>
                      )}
                      <span>{new Date(req.requested_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>

                    {req.sdr_notes && (
                      <p className="text-[11px] text-[#64748B] bg-[#F8FAFC] rounded-lg px-2.5 py-1.5 border border-[#F1F5F9]">
                        <span className="font-medium text-[#374151]">SDR note:</span> {req.sdr_notes}
                      </p>
                    )}

                    {req.org?.thematic_areas && req.org.thematic_areas.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {req.org.thematic_areas.slice(0, 4).map((t: string) => (
                          <span key={t} className="text-[10px] bg-[#EFF6FF] text-[#1A56DB] px-1.5 py-0.5 rounded-full">{t}</span>
                        ))}
                      </div>
                    )}

                    {!isPending && (
                      <p className="text-[10px] text-[#94A3B8]">
                        {req.status.charAt(0).toUpperCase() + req.status.slice(1)} by {req.reviewer?.name ?? 'Admin'}
                        {req.reviewed_at ? ` · ${new Date(req.reviewed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}
                        {req.admin_note ? ` · "${req.admin_note}"` : ''}
                      </p>
                    )}
                  </div>

                  {/* Actions — pending only */}
                  {isPending && (
                    <div className="shrink-0 flex flex-col gap-2 items-end">
                      <input
                        value={notes[req.id] ?? ''}
                        onChange={e => setNotes(n => ({ ...n, [req.id]: e.target.value }))}
                        placeholder="Admin note (optional)"
                        className="w-52 px-2.5 py-1.5 text-xs border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20 text-right"
                      />
                      <div className="flex gap-1.5">
                        {claimType === 'data_enrichment' ? (
                          <>
                            <button
                              onClick={() => action(req.id, 'fulfilled')}
                              disabled={isActioning}
                              className="flex items-center gap-1 px-3 py-1.5 bg-[#1A56DB] text-white text-[11px] font-semibold rounded-lg hover:bg-[#1e40af] disabled:opacity-60 transition-colors"
                            >
                              {isActioning ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                              Mark Fulfilled
                            </button>
                            <button
                              onClick={() => action(req.id, 'rejected')}
                              disabled={isActioning}
                              className="flex items-center gap-1 px-3 py-1.5 border border-[#E2E8F0] text-[#64748B] text-[11px] font-semibold rounded-lg hover:bg-[#F8FAFC] disabled:opacity-60 transition-colors"
                            >
                              <XCircle className="w-3 h-3" />
                              Reject
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => action(req.id, 'approved')}
                              disabled={isActioning}
                              className="flex items-center gap-1 px-3 py-1.5 bg-[#1A56DB] text-white text-[11px] font-semibold rounded-lg hover:bg-[#1e40af] disabled:opacity-60 transition-colors"
                            >
                              {isActioning ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                              Approve &amp; Assign
                            </button>
                            <button
                              onClick={() => action(req.id, 'rejected')}
                              disabled={isActioning}
                              className="flex items-center gap-1 px-3 py-1.5 border border-[#E2E8F0] text-[#64748B] text-[11px] font-semibold rounded-lg hover:bg-[#F8FAFC] disabled:opacity-60 transition-colors"
                            >
                              <XCircle className="w-3 h-3" />
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Returned Leads (not interested / dead / ban requests) ─────────────────────
function ReturnedLeadsSection() {
  const [leads, setLeads] = useState<any[]>([])
  const [sdrs, setSdrs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [pick, setPick] = useState<Record<string, string>>({})
  // Add-contact modal (Not Interested group): enrich the org with a fresh KDM before reassigning
  const [addContactFor, setAddContactFor] = useState<{ orgId: string; orgName: string } | null>(null)
  const [cForm, setCForm] = useState({ name: '', designation: '', phone: '', email: '', is_primary: false })
  const [cSaving, setCSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [lRes, uRes] = await Promise.all([
      fetch('/api/admin/returned-leads').then(r => r.json()).catch(() => []),
      fetch('/api/users').then(r => r.json()).catch(() => []),
    ])
    setLeads(Array.isArray(lRes) ? lRes : [])
    setSdrs((Array.isArray(uRes) ? uRes : []).filter((u: any) => u.role === 'sdr' && u.is_active))
    setLoading(false)
  }

  async function reassign(leadId: string) {
    const to = pick[leadId]
    if (!to) return
    setBusy(leadId)
    const res = await fetch(`/api/leads/${leadId}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to_user_id: to, reason: 'Reassigned from Returned leads' }),
    })
    if (res.ok) setLeads(prev => prev.filter(l => l.id !== leadId))
    else alert('Failed to reassign.')
    setBusy(null)
  }

  // Confirm an SDR ban request — follows the SAME canonical path as "Mark as Banned" in the
  // Lead Pool (banOrg): PATCH org { is_banned: true }. The org is then hidden from all SDR/Closer
  // workspaces, flagged red in org search, and appears in Datasets → Banned Organisations.
  async function confirmBan(leadId: string, orgId: string, orgName: string) {
    if (!orgId) return
    if (!confirm(`Mark "${orgName}" as a banned organisation?\n\nIt will be hidden from all SDR and Closer workspaces and flagged red in org search. You can unban it from Datasets → Banned Organisations.`)) return
    setBusy(leadId)
    const res = await fetch(`/api/organizations/${orgId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_banned: true }),
    })
    if (res.ok) setLeads(prev => prev.filter(l => l.id !== leadId))
    else { const d = await res.json().catch(() => ({})); alert(d.error ?? 'Failed to ban.') }
    setBusy(null)
  }

  // Add a new KDM/contact to a returned org (Not Interested group) before reassigning.
  async function submitContact() {
    if (!addContactFor || !cForm.name.trim()) return
    setCSaving(true)
    const res = await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: addContactFor.orgId, ...cForm }),
    })
    if (res.ok) setAddContactFor(null)
    else { const d = await res.json().catch(() => ({})); alert(d.error ?? 'Failed to add contact.') }
    setCSaving(false)
  }

  const SHORT: Record<string, string> = { 'Cold Call': 'Call', 'Cold Email': 'Email' }
  const GROUPS = [
    { key: 'not_interested', label: 'Not Interested', color: '#D97706' },
    { key: 'dead',           label: 'Dead',           color: '#EF4444' },
    { key: 'ban_requested',  label: 'Ban Requests',   color: '#DC2626' },
  ]

  if (loading) {
    return <div className="flex-1 p-6"><p className="text-sm text-[#94A3B8]">Loading…</p></div>
  }

  return (
    <div className="flex-1 p-6 space-y-6 overflow-y-auto">
      {leads.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm font-medium text-[#374151]">No returned leads</p>
          <p className="text-xs text-[#94A3B8] mt-1">Leads marked not-interested, dead, or flagged for ban will appear here.</p>
        </div>
      )}
      {GROUPS.map(g => {
        const items = leads.filter(l => (l.returned_reason ?? 'dead') === g.key)
        if (items.length === 0) return null
        return (
          <div key={g.key}>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: g.color }} />
              <h3 className="text-[13px] font-semibold text-[#0F172A]">{g.label}</h3>
              <span className="text-[11px] text-[#94A3B8]">({items.length})</span>
            </div>
            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm divide-y divide-[#F1F5F9]">
              {items.map(l => (
                <div key={l.id} className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#0F172A] truncate">{l.organization?.name ?? '—'}</p>
                    <div className="flex flex-wrap items-center gap-x-3 text-[11px] text-[#94A3B8] mt-0.5">
                      {l.organization?.location && <span>{l.organization.location}</span>}
                      <span>Tried: {(l.methods ?? []).map((m: string) => SHORT[m] ?? m).join(' · ') || 'none'}</span>
                      {l.assignee?.name && <span>Was: {l.assignee.name}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {(g.key === 'not_interested' || g.key === 'dead') && (
                      <button
                        onClick={() => { setCForm({ name: '', designation: '', phone: '', email: '', is_primary: false }); setAddContactFor({ orgId: l.organization?.id, orgName: l.organization?.name ?? 'this org' }) }}
                        disabled={busy === l.id || !l.organization?.id}
                        className="px-2.5 py-1.5 text-[11px] font-semibold text-[#1A56DB] border border-[#BFD3F5] rounded-lg hover:bg-[#EFF4FE] disabled:opacity-50 transition-colors"
                        title="Add a new contact (KDM) to this org before reassigning"
                      >
                        Add contact
                      </button>
                    )}
                    {g.key === 'ban_requested' && (
                      <button
                        onClick={() => confirmBan(l.id, l.organization?.id, l.organization?.name ?? 'this org')}
                        disabled={busy === l.id}
                        className="px-2.5 py-1.5 text-[11px] font-semibold text-white bg-[#DC2626] rounded-lg hover:bg-[#B91C1C] disabled:opacity-50 transition-colors"
                      >
                        Confirm Ban
                      </button>
                    )}
                    <select
                      value={pick[l.id] ?? ''}
                      onChange={e => setPick(p => ({ ...p, [l.id]: e.target.value }))}
                      className="px-2 py-1.5 text-[11px] border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20"
                    >
                      <option value="">Reassign to…</option>
                      {sdrs.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                    <button
                      onClick={() => reassign(l.id)}
                      disabled={busy === l.id || !pick[l.id]}
                      className="px-2.5 py-1.5 text-[11px] font-semibold text-white bg-[#1A56DB] rounded-lg hover:bg-[#1A4FBF] disabled:opacity-50 transition-colors"
                    >
                      Reassign
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {/* Add-contact modal — enrich a Not-Interested org with a new KDM before reassigning */}
      {addContactFor && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-semibold text-[#0F172A]">Add contact</h3>
            <p className="text-sm text-[#64748B] mt-1">New KDM for <span className="font-medium text-[#0F172A]">{addContactFor.orgName}</span>. Reassign the lead afterwards to try this contact.</p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#64748B] mb-1">Name <span className="text-red-500">*</span></label>
                <input
                  value={cForm.name}
                  onChange={e => setCForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20"
                  placeholder="Contact name"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#64748B] mb-1">Designation</label>
                <input
                  value={cForm.designation}
                  onChange={e => setCForm(f => ({ ...f, designation: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20"
                  placeholder="e.g. Founder, Program Director"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#64748B] mb-1">Phone</label>
                  <input
                    value={cForm.phone}
                    onChange={e => setCForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20"
                    placeholder="Phone"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#64748B] mb-1">Email</label>
                  <input
                    value={cForm.email}
                    onChange={e => setCForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20"
                    placeholder="Email"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-[#64748B]">
                <input
                  type="checkbox"
                  checked={cForm.is_primary}
                  onChange={e => setCForm(f => ({ ...f, is_primary: e.target.checked }))}
                  className="rounded border-[#E2E8F0]"
                />
                Set as primary KDM
              </label>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={submitContact}
                disabled={cSaving || !cForm.name.trim()}
                className="flex-1 py-2 bg-[#1A56DB] text-white text-sm font-medium rounded-lg hover:bg-[#1A4FBF] disabled:opacity-60 transition-colors"
              >
                {cSaving ? 'Adding…' : 'Add contact'}
              </button>
              <button
                onClick={() => setAddContactFor(null)}
                disabled={cSaving}
                className="py-2 px-4 border border-[#E2E8F0] text-sm text-[#64748B] rounded-lg hover:bg-[#F8FAFC] disabled:opacity-60"
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
