'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import TopBar from '@/components/layout/TopBar'
import { createClient } from '@/lib/supabase/client'
import { LEAD_STATUS_LABELS, LEAD_STATUS_COLORS, INTEREST_SIGNAL_LABELS, INTEREST_SIGNAL_COLORS } from '@/lib/constants'
import { formatRelativeDate, cn } from '@/lib/utils'
import { Search, ChevronRight, Plus, Pencil, Send, Trash2 } from 'lucide-react'
import DateTimePicker from '@/components/ui/DateTimePicker'
import OrgSearchInput from '@/components/crm/OrgSearchInput'
import OrgSearchModal from '@/components/crm/OrgSearchModal'
import type { OrgSearchResult } from '@/app/api/organizations/search/route'
import type { Lead, Organization, InterestSignal, LeadStatus } from '@/types/database'

interface LeadWithOrg extends Lead {
  organization: Organization
  primaryContact?: { name: string | null; phone: string | null } | null
}

export default function SDRLeadsPage() {
  const [leads, setLeads] = useState<LeadWithOrg[]>([])
  const [filtered, setFiltered] = useState<LeadWithOrg[]>([])
  const [allSDRLeads, setAllSDRLeads] = useState<LeadWithOrg[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedLead, setSelectedLead] = useState<LeadWithOrg | null>(null)
  const [showPanel, setShowPanel] = useState(false)
  const [showAddLead,   setShowAddLead]   = useState(false)
  const [showOrgSearch, setShowOrgSearch] = useState(false)
  const [deletingLeadId, setDeletingLeadId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const supabase = createClient()
  const router = useRouter()

  async function deleteLead(leadId: string) {
    setDeletingLeadId(leadId)
    const res = await fetch(`/api/leads/${leadId}`, { method: 'DELETE' })
    if (res.ok) {
      setLeads(prev => prev.filter(l => l.id !== leadId))
      setFiltered(prev => prev.filter(l => l.id !== leadId))
      setAllSDRLeads(prev => prev.filter(l => l.id !== leadId))
      if (selectedLead?.id === leadId) { setShowPanel(false); setSelectedLead(null) }
    }
    setDeletingLeadId(null)
    setConfirmDeleteId(null)
  }

  useEffect(() => { fetchLeads() }, [])
  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(leads.filter(l =>
      l.organization?.name?.toLowerCase().includes(q) ||
      l.organization?.location?.toLowerCase().includes(q) ||
      l.status?.toLowerCase().includes(q) ||
      l.primaryContact?.name?.toLowerCase().includes(q) ||
      l.primaryContact?.phone?.toLowerCase().includes(q)
    ))
  }, [search, leads])

  // Statuses that should NOT appear in Assigned Leads (they live in Follow-ups or are handed off)
  const EXCLUDE_FROM_ASSIGNED = new Set(['demo_booked', 'call_again', 'not_reachable', 'not_interested'])

  async function fetchLeads() {
    const { data: user } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('users').select('id').eq('auth_id', user.user!.id).single()
    if (!profile) return

    const res = await fetch(`/api/leads?assigned_to=${profile.id}`)
    const data: LeadWithOrg[] = await res.json()
    const fullData = data ?? []

    // Fetch primary contacts for ALL leads (active + follow-up + demos) for cross-section search
    const allOrgIds = fullData.map(l => l.org_id).filter(Boolean)
    let contactMap: Record<string, { name: string | null; phone: string | null }> = {}
    if (allOrgIds.length > 0) {
      const { data: contactData } = await supabase
        .from('contacts')
        .select('org_id, name, phone')
        .in('org_id', allOrgIds)
        .eq('is_primary', true)

      ;(contactData ?? []).forEach((c: any) => {
        if (!contactMap[c.org_id]) contactMap[c.org_id] = { name: c.name, phone: c.phone }
      })
    }

    // All leads with contacts merged in (for workspace-wide search)
    const allWithContacts = fullData.map(l => ({
      ...l,
      primaryContact: contactMap[l.org_id] ?? null,
    }))
    setAllSDRLeads(allWithContacts)

    // Only show active working leads in the My Leads list
    const active = allWithContacts.filter(l => !EXCLUDE_FROM_ASSIGNED.has(l.status))
    setLeads(active)
    setFiltered(active)
    setLoading(false)
  }

  // Cross-section search — runs when user types in the search bar
  const searchDropdown = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return null

    function matchLead(l: LeadWithOrg) {
      return (
        l.organization?.name?.toLowerCase().includes(q) ||
        l.organization?.location?.toLowerCase().includes(q) ||
        l.primaryContact?.name?.toLowerCase().includes(q) ||
        l.primaryContact?.phone?.toLowerCase().includes(q)
      )
    }

    return {
      myLeads:  leads.filter(matchLead).slice(0, 4),
      followup: allSDRLeads.filter(l => ['call_again', 'not_reachable'].includes(l.status) && matchLead(l)).slice(0, 3),
      demos:    allSDRLeads.filter(l => l.status === 'demo_booked' && matchLead(l)).slice(0, 3),
    }
  }, [search, leads, allSDRLeads])

  function openLead(lead: LeadWithOrg) {
    setSelectedLead(lead)
    setShowPanel(true)
  }

  if (loading) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="h-14 bg-white border-b border-[#E8EDF3]" />
        <div className="p-4 border-b border-[#E2E8F0] bg-white flex gap-2">
          <div className="h-9 flex-1 bg-[#F1F5F9] rounded-lg skeleton" />
          <div className="h-9 w-24 bg-[#F1F5F9] rounded-lg skeleton" />
        </div>
        <div className="flex-1 bg-[#F8FAFC]">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="px-4 py-4 bg-white border-b border-[#F1F5F9] space-y-2">
              <div className="h-3.5 w-36 bg-[#F1F5F9] rounded skeleton" />
              <div className="h-3 w-24 bg-[#F1F5F9] rounded skeleton" />
              <div className="h-5 w-20 bg-[#F1F5F9] rounded-full skeleton mt-1" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 flex">
      {/* Lead list */}
      <div className={cn('flex flex-col transition-all', showPanel ? 'w-96' : 'flex-1')}>
        <TopBar title="My Leads" subtitle={`${filtered.length} leads`} />

        <div className="p-4 border-b border-[#E2E8F0] bg-white flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search across My Leads, Follow-ups, Demos..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20 focus:border-[#1A56DB]"
            />

            {/* Workspace-wide search dropdown */}
            {searchDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-[#E2E8F0] shadow-lg z-50 overflow-hidden max-h-96 overflow-y-auto">
                {searchDropdown.myLeads.length === 0 && searchDropdown.followup.length === 0 && searchDropdown.demos.length === 0 ? (
                  <p className="text-xs text-[#94A3B8] text-center py-4">No results found</p>
                ) : (
                  <>
                    {searchDropdown.myLeads.length > 0 && (
                      <div>
                        <div className="px-3 py-1.5 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8]">My Leads</p>
                        </div>
                        {searchDropdown.myLeads.map(lead => (
                          <button
                            key={lead.id}
                            onMouseDown={e => { e.preventDefault(); openLead(lead) }}
                            className="w-full text-left px-3 py-2.5 hover:bg-[#F8FAFC] transition-colors border-b border-[#F1F5F9] last:border-0"
                          >
                            <p className="text-[13px] font-medium text-[#0F172A]">{lead.organization?.name}</p>
                            {lead.organization?.location && (
                              <p className="text-[11px] text-[#94A3B8]">{lead.organization.location}</p>
                            )}
                          </button>
                        ))}
                      </div>
                    )}

                    {searchDropdown.followup.length > 0 && (
                      <div>
                        <div className="px-3 py-1.5 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8]">Follow-up Queue</p>
                        </div>
                        {searchDropdown.followup.map(lead => (
                          <button
                            key={lead.id}
                            onMouseDown={e => { e.preventDefault(); router.push(`/sdr/followups?open=${lead.id}`) }}
                            className="w-full text-left px-3 py-2.5 hover:bg-[#F8FAFC] transition-colors border-b border-[#F1F5F9] last:border-0"
                          >
                            <p className="text-[13px] font-medium text-[#0F172A]">{lead.organization?.name}</p>
                            <p className="text-[11px] text-[#94A3B8]">{lead.organization?.location ?? ''}{lead.organization?.location ? ' · ' : ''}Follow-up pending</p>
                          </button>
                        ))}
                      </div>
                    )}

                    {searchDropdown.demos.length > 0 && (
                      <div>
                        <div className="px-3 py-1.5 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8]">My Demos</p>
                        </div>
                        {searchDropdown.demos.map(lead => (
                          <button
                            key={lead.id}
                            onMouseDown={e => { e.preventDefault(); router.push('/sdr/demos') }}
                            className="w-full text-left px-3 py-2.5 hover:bg-[#F8FAFC] transition-colors border-b border-[#F1F5F9] last:border-0"
                          >
                            <p className="text-[13px] font-medium text-[#0F172A]">{lead.organization?.name}</p>
                            <p className="text-[11px] text-[#94A3B8]">{lead.organization?.location ?? ''}{lead.organization?.location ? ' · ' : ''}Demo booked</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
          <button
            onClick={() => setShowOrgSearch(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-[#374151] text-xs font-semibold rounded-lg border border-[#E2E8F0] hover:bg-[#F1F5F9] transition-colors shrink-0"
          >
            <Search className="w-3.5 h-3.5" />
            Search Orgs
          </button>
          <button
            onClick={() => setShowAddLead(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#1A56DB] text-white text-xs font-semibold rounded-lg hover:bg-[#1e40af] transition-colors shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Lead
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-[#F8FAFC]">
          <div className="divide-y divide-[#F1F5F9]">
            {filtered.map(lead => (
              <div
                key={lead.id}
                className={cn(
                  'group relative w-full text-left px-4 py-3.5 bg-white hover:bg-[#F8FAFC] transition-colors cursor-pointer',
                  selectedLead?.id === lead.id && 'bg-[#EFF6FF] border-l-2 border-[#1A56DB]'
                )}
                onClick={() => openLead(lead)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-sm text-[#0F172A] truncate">
                        {lead.organization?.name}
                      </p>
                      {lead.interest_signal && (
                        <span className={cn('shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full', INTEREST_SIGNAL_COLORS[lead.interest_signal as InterestSignal])}>
                          {lead.interest_signal.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#94A3B8] truncate">
                      {lead.organization?.location} · SQL {(lead.organization as any)?.sql_score_label ?? (lead.organization?.sql_score != null ? `${lead.organization.sql_score}/8` : 'N/A')}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', LEAD_STATUS_COLORS[lead.status as LeadStatus])}>
                        {LEAD_STATUS_LABELS[lead.status as LeadStatus]}
                      </span>
                      {lead.follow_up_date && (
                        <span className="text-[10px] text-[#94A3B8]">
                          FU: {formatRelativeDate(lead.follow_up_date)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 mt-0.5">
                    {/* Delete button / inline confirmation */}
                    {confirmDeleteId === lead.id ? (
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <span className="text-[10px] text-[#EF4444] font-medium">Delete?</span>
                        <button
                          onClick={() => deleteLead(lead.id)}
                          disabled={deletingLeadId === lead.id}
                          className="px-1.5 py-0.5 bg-[#EF4444] text-white text-[10px] font-semibold rounded disabled:opacity-60 hover:bg-[#DC2626]"
                        >
                          {deletingLeadId === lead.id ? '...' : 'Yes'}
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); setConfirmDeleteId(null) }}
                          className="px-1.5 py-0.5 border border-[#E2E8F0] text-[#64748B] text-[10px] rounded hover:bg-[#F8FAFC]"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={e => { e.stopPropagation(); setConfirmDeleteId(lead.id) }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-[#94A3B8] hover:text-[#EF4444] transition-all"
                        title="Delete lead"
                      >
                        <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                      </button>
                    )}
                    <ChevronRight className="w-4 h-4 text-[#CBD5E1]" />
                  </div>
                </div>
              </div>
            ))}

            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <div className="w-10 h-10 rounded-xl bg-[#F1F5F9] flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-[#94A3B8]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 0 2-2h2a2 2 0 0 0 2 2" />
                  </svg>
                </div>
                <p className="text-[13px] font-medium text-[#374151]">{search ? 'No leads match your search' : 'No leads in your queue'}</p>
                {search
                  ? <p className="text-[11px] text-[#94A3B8] mt-1">Try a different search term</p>
                  : <p className="text-[11px] text-[#94A3B8] mt-1">Add a lead manually or wait for assignment</p>
                }
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lead detail panel — right side */}
      {showPanel && selectedLead && (
        <div className="flex-1 border-l border-[#E2E8F0] bg-white overflow-y-auto">
          <LeadDetailPanel
            lead={selectedLead}
            onClose={() => { setShowPanel(false); setSelectedLead(null) }}
            onRefresh={fetchLeads}
            onDemoBooked={(leadId: string) => {
              // Optimistically remove the demo-booked lead from all lists and close panel
              setLeads(prev => prev.filter(l => l.id !== leadId))
              setFiltered(prev => prev.filter(l => l.id !== leadId))
              setAllSDRLeads(prev => prev.filter(l => l.id !== leadId))
              setShowPanel(false)
              setSelectedLead(null)
            }}
          />
        </div>
      )}

      {/* Add Lead modal */}
      {showAddLead && (
        <AddLeadModal
          onClose={() => setShowAddLead(false)}
          onSuccess={() => { setShowAddLead(false); fetchLeads() }}
        />
      )}

      {/* Org search modal */}
      {showOrgSearch && (
        <OrgSearchModal role="sdr" onClose={() => setShowOrgSearch(false)} />
      )}
    </div>
  )
}

// ── Add Lead Modal ─────────────────────────────────────────────────────────────
function AddLeadModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [orgName,      setOrgName]      = useState('')
  const [selectedOrg,  setSelectedOrg]  = useState<OrgSearchResult | null>(null)
  const [location, setLocation] = useState('')
  const [orgUrl, setOrgUrl] = useState('')
  const [orgLinkedin, setOrgLinkedin] = useState('')
  const [thematicAreas, setThematicAreas] = useState<string[]>([])
  const [thematicInput, setThematicInput] = useState('')
  const [kdmName, setKdmName] = useState('')
  const [kdmPhone, setKdmPhone] = useState('')
  const [kdmDesignation, setKdmDesignation] = useState('')
  const [kdmEmail, setKdmEmail] = useState('')
  const [kdmLinkedin, setKdmLinkedin] = useState('')
  // KDM2
  const [showKdm2, setShowKdm2] = useState(false)
  const [kdm2Name, setKdm2Name] = useState('')
  const [kdm2Phone, setKdm2Phone] = useState('')
  const [kdm2Designation, setKdm2Designation] = useState('')
  const [kdm2Email, setKdm2Email] = useState('')
  const [kdm2Linkedin, setKdm2Linkedin] = useState('')
  // KDM3
  const [showKdm3, setShowKdm3] = useState(false)
  const [kdm3Name, setKdm3Name] = useState('')
  const [kdm3Phone, setKdm3Phone] = useState('')
  const [kdm3Designation, setKdm3Designation] = useState('')
  const [kdm3Email, setKdm3Email] = useState('')
  const [kdm3Linkedin, setKdm3Linkedin] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function addThematicTag(raw: string) {
    const tags = raw.split(',').map(t => t.trim()).filter(Boolean)
    setThematicAreas(prev => {
      const merged = [...prev]
      tags.forEach(t => { if (!merged.includes(t)) merged.push(t) })
      return merged
    })
    setThematicInput('')
  }

  function handleThematicKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      if (thematicInput.trim()) addThematicTag(thematicInput)
    } else if (e.key === 'Backspace' && !thematicInput && thematicAreas.length > 0) {
      setThematicAreas(prev => prev.slice(0, -1))
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    // Commit any pending thematic input
    if (thematicInput.trim()) addThematicTag(thematicInput)
    setError('')
    setSaving(true)
    const res = await fetch('/api/leads/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        org_name: orgName,
        location,
        org_url: orgUrl,
        org_linkedin: orgLinkedin,
        thematic_areas: thematicAreas,
        kdm_name: kdmName,
        kdm_phone: kdmPhone,
        kdm_designation: kdmDesignation,
        kdm_email: kdmEmail,
        kdm_linkedin: kdmLinkedin,
        ...(showKdm2 && kdm2Name.trim() ? {
          kdm2_name: kdm2Name,
          kdm2_phone: kdm2Phone,
          kdm2_designation: kdm2Designation,
          kdm2_email: kdm2Email,
          kdm2_linkedin: kdm2Linkedin,
        } : {}),
        ...(showKdm3 && kdm3Name.trim() ? {
          kdm3_name: kdm3Name,
          kdm3_phone: kdm3Phone,
          kdm3_designation: kdm3Designation,
          kdm3_email: kdm3Email,
          kdm3_linkedin: kdm3Linkedin,
        } : {}),
        notes,
      }),
    })
    if (res.ok) {
      onSuccess()
    } else {
      const d = await res.json()
      setError(d.error ?? 'Something went wrong')
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="font-semibold text-[#0F172A] text-base">Add Lead Manually</h3>
            <p className="text-xs text-[#64748B] mt-0.5">Creates org + KDM contact → appears in your Assigned Leads</p>
          </div>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#64748B] text-xl leading-none">×</button>
        </div>

        <form onSubmit={submit} className="space-y-4">

          {/* ── Organisation ─────────────────────────────────────────────── */}
          <div className="space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8]">Organisation</p>

            <div>
              <label className="block text-xs text-[#64748B] mb-1">Name <span className="text-red-500">*</span></label>
              <OrgSearchInput
                required
                value={orgName}
                onChange={setOrgName}
                onOrgSelected={org => {
                  setSelectedOrg(org)
                  if (org) {
                    if (org.location) setLocation(org.location)
                    if (org.thematic_areas) setThematicAreas(org.thematic_areas)
                  }
                }}
                placeholder="Organisation name"
                inputClassName="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20 focus:border-[#1A56DB]"
              />
              {selectedOrg && selectedOrg.status !== 'in_database' && (
                <div className="mt-2 flex items-start gap-1.5 bg-[#FEF3C7] border border-[#FCD34D] rounded-lg px-2.5 py-2">
                  <svg className="w-3.5 h-3.5 text-[#92400E] mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                  </svg>
                  <div>
                    <p className="text-[11px] font-semibold text-[#92400E]">
                      This org already exists in the system
                    </p>
                    <p className="text-[10px] text-[#92400E] mt-0.5">
                      {selectedOrg.status_label}{selectedOrg.assignee_name ? ` · ${selectedOrg.assignee_name}` : ''}.
                      {' '}A new entry will be created when you submit.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#64748B] mb-1">Location</label>
                <input
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  placeholder="City, State"
                  className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20"
                />
              </div>
              <div>
                <label className="block text-xs text-[#64748B] mb-1">Website</label>
                <input
                  value={orgUrl}
                  onChange={e => setOrgUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-[#64748B] mb-1">LinkedIn URL</label>
              <input
                value={orgLinkedin}
                onChange={e => setOrgLinkedin(e.target.value)}
                placeholder="https://linkedin.com/company/..."
                className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20"
              />
            </div>

            <div>
              <label className="block text-xs text-[#64748B] mb-1">
                Thematic Areas
                <span className="text-[#94A3B8] font-normal ml-1">(Enter or comma to add)</span>
              </label>
              <div className="flex flex-wrap gap-1.5 px-3 py-2 border border-[#E2E8F0] rounded-lg min-h-[38px] cursor-text focus-within:ring-2 focus-within:ring-[#1A56DB]/20 focus-within:border-[#1A56DB]"
                onClick={e => (e.currentTarget.querySelector('input') as HTMLInputElement)?.focus()}
              >
                {thematicAreas.map(tag => (
                  <span key={tag} className="flex items-center gap-1 bg-[#EFF6FF] text-[#1A56DB] text-[11px] font-medium px-2 py-0.5 rounded-full">
                    {tag}
                    <button type="button" onClick={() => setThematicAreas(prev => prev.filter(t => t !== tag))} className="text-[#93C5FD] hover:text-[#1A56DB] leading-none">×</button>
                  </span>
                ))}
                <input
                  value={thematicInput}
                  onChange={e => setThematicInput(e.target.value)}
                  onKeyDown={handleThematicKeyDown}
                  onBlur={() => { if (thematicInput.trim()) addThematicTag(thematicInput) }}
                  placeholder={thematicAreas.length === 0 ? 'e.g. Education, Health...' : ''}
                  className="flex-1 min-w-[80px] text-sm outline-none bg-transparent"
                />
              </div>
            </div>
          </div>

          {/* ── Key Decision Maker ───────────────────────────────────────── */}
          <div className="space-y-3 pt-2 border-t border-[#F1F5F9]">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8]">Key Decision Maker</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#64748B] mb-1">Name <span className="text-red-500">*</span></label>
                <input
                  required
                  value={kdmName}
                  onChange={e => setKdmName(e.target.value)}
                  placeholder="Full name"
                  className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20"
                />
              </div>
              <div>
                <label className="block text-xs text-[#64748B] mb-1">Designation</label>
                <input
                  value={kdmDesignation}
                  onChange={e => setKdmDesignation(e.target.value)}
                  placeholder="CEO, CFO..."
                  className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#64748B] mb-1">Phone</label>
                <input
                  value={kdmPhone}
                  onChange={e => setKdmPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20"
                />
              </div>
              <div>
                <label className="block text-xs text-[#64748B] mb-1">Email</label>
                <input
                  type="email"
                  value={kdmEmail}
                  onChange={e => setKdmEmail(e.target.value)}
                  placeholder="name@org.com"
                  className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-[#64748B] mb-1">LinkedIn URL</label>
              <input
                value={kdmLinkedin}
                onChange={e => setKdmLinkedin(e.target.value)}
                placeholder="https://linkedin.com/in/..."
                className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20"
              />
            </div>

            {/* KDM2 */}
            {showKdm2 ? (
              <div className="space-y-3 pt-2 border-t border-[#F1F5F9]">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8]">2nd Decision Maker</p>
                  <button
                    type="button"
                    onClick={() => { setShowKdm2(false); setKdm2Name(''); setShowKdm3(false); setKdm3Name('') }}
                    className="text-xs text-[#94A3B8] hover:text-[#EF4444] transition-colors"
                  >
                    Remove
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[#64748B] mb-1">Name</label>
                    <input value={kdm2Name} onChange={e => setKdm2Name(e.target.value)} placeholder="Full name" className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20" />
                  </div>
                  <div>
                    <label className="block text-xs text-[#64748B] mb-1">Designation</label>
                    <input value={kdm2Designation} onChange={e => setKdm2Designation(e.target.value)} placeholder="CEO, CFO..." className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[#64748B] mb-1">Phone</label>
                    <input value={kdm2Phone} onChange={e => setKdm2Phone(e.target.value)} placeholder="+91 98765 43210" className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20" />
                  </div>
                  <div>
                    <label className="block text-xs text-[#64748B] mb-1">Email</label>
                    <input type="email" value={kdm2Email} onChange={e => setKdm2Email(e.target.value)} placeholder="name@org.com" className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-[#64748B] mb-1">LinkedIn URL</label>
                  <input value={kdm2Linkedin} onChange={e => setKdm2Linkedin(e.target.value)} placeholder="https://linkedin.com/in/..." className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20" />
                </div>

                {/* KDM3 */}
                {showKdm3 ? (
                  <div className="space-y-3 pt-2 border-t border-[#F1F5F9]">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8]">3rd Decision Maker</p>
                      <button
                        type="button"
                        onClick={() => { setShowKdm3(false); setKdm3Name('') }}
                        className="text-xs text-[#94A3B8] hover:text-[#EF4444] transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-[#64748B] mb-1">Name</label>
                        <input value={kdm3Name} onChange={e => setKdm3Name(e.target.value)} placeholder="Full name" className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20" />
                      </div>
                      <div>
                        <label className="block text-xs text-[#64748B] mb-1">Designation</label>
                        <input value={kdm3Designation} onChange={e => setKdm3Designation(e.target.value)} placeholder="CEO, CFO..." className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-[#64748B] mb-1">Phone</label>
                        <input value={kdm3Phone} onChange={e => setKdm3Phone(e.target.value)} placeholder="+91 98765 43210" className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20" />
                      </div>
                      <div>
                        <label className="block text-xs text-[#64748B] mb-1">Email</label>
                        <input type="email" value={kdm3Email} onChange={e => setKdm3Email(e.target.value)} placeholder="name@org.com" className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-[#64748B] mb-1">LinkedIn URL</label>
                      <input value={kdm3Linkedin} onChange={e => setKdm3Linkedin(e.target.value)} placeholder="https://linkedin.com/in/..." className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20" />
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowKdm3(true)}
                    className="w-full py-2 border border-dashed border-[#E2E8F0] text-xs text-[#64748B] rounded-lg hover:border-[#1A56DB] hover:text-[#1A56DB] transition-colors"
                  >
                    + Add third KDM
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowKdm2(true)}
                className="w-full py-2 border border-dashed border-[#E2E8F0] text-xs text-[#64748B] rounded-lg hover:border-[#1A56DB] hover:text-[#1A56DB] transition-colors"
              >
                + Add another KDM
              </button>
            )}
          </div>

          {/* ── Notes ────────────────────────────────────────────────────── */}
          <div className="pt-2 border-t border-[#F1F5F9]">
            <label className="block text-xs text-[#64748B] mb-1">Notes <span className="text-[#94A3B8] font-normal">(optional)</span></label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="How did you find this lead? Any context..."
              className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20 resize-none"
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={saving || !orgName.trim() || !kdmName.trim()}
              className="flex-1 py-2.5 bg-[#1A56DB] text-white text-sm font-medium rounded-xl hover:bg-[#1e40af] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Adding...' : 'Add Lead →'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 border border-[#E2E8F0] text-sm text-[#64748B] rounded-xl hover:bg-[#F8FAFC]"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Inline Lead Detail Panel ────────────────────────────────────────────────

function LeadDetailPanel({
  lead,
  onClose,
  onRefresh,
  onDemoBooked,
}: {
  lead: LeadWithOrg
  onClose: () => void
  onRefresh: () => void
  onDemoBooked: (leadId: string) => void
}) {
  const [tab, setTab] = useState<'overview' | 'comments' | 'contacts'>('overview')
  const [activities, setActivities] = useState<any[]>([])
  const [contacts, setContacts] = useState<any[]>([])
  const [comments, setComments] = useState<any[]>([])
  const [commentText, setCommentText] = useState('')
  const [postingComment, setPostingComment] = useState(false)
  const [showLogActivity, setShowLogActivity] = useState(false)
  const [showBookDemo, setShowBookDemo] = useState(false)
  const [showEditLead, setShowEditLead] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetch(`/api/leads/${lead.id}`)
      .then(r => r.json())
      .then(d => { setActivities(d.activities ?? []); setContacts(d.contacts ?? []) })
  }, [lead.id])

  useEffect(() => {
    if (tab === 'comments') fetchComments()
  }, [tab, lead.id])

  function fetchComments() {
    fetch(`/api/leads/comments?lead_id=${lead.id}&source=lead`)
      .then(r => r.json())
      .then(d => setComments(Array.isArray(d) ? d : []))
  }

  async function postComment() {
    if (!commentText.trim()) return
    setPostingComment(true)
    const res = await fetch('/api/leads/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_id: lead.id, comment: commentText.trim(), source: 'lead' }),
    })
    if (res.ok) {
      const newComment = await res.json()
      setComments(prev => [newComment, ...prev])
      setCommentText('')
    }
    setPostingComment(false)
  }

  const org = lead.organization

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#E2E8F0]">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-semibold text-[#0F172A] text-base">{org?.name}</h2>
            <p className="text-xs text-[#94A3B8] mt-0.5">{org?.location} · {org?.annual_revenue ? `₹${(org.annual_revenue / 100000).toFixed(0)}L revenue` : 'Revenue N/A'}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowEditLead(true)}
              className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#94A3B8] hover:text-[#374151] transition-colors"
              title="Edit org & contact"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button onClick={onClose} className="text-[#94A3B8] hover:text-[#64748B] text-lg leading-none">×</button>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', LEAD_STATUS_COLORS[lead.status as LeadStatus])}>
            {LEAD_STATUS_LABELS[lead.status as LeadStatus]}
          </span>
          <span className="text-[10px] text-[#94A3B8]">SQL: {(org as any)?.sql_score_label ?? (org?.sql_score != null ? `${org.sql_score}/8` : 'N/A')}</span>
          {lead.interest_signal && (
            <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', INTEREST_SIGNAL_COLORS[lead.interest_signal as InterestSignal])}>
              {lead.interest_signal.toUpperCase()}
            </span>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="px-5 py-3 border-b border-[#E2E8F0] flex gap-2">
        <button
          onClick={() => setShowLogActivity(true)}
          disabled={lead.phase === 'closer'}
          className="flex-1 py-1.5 text-xs font-medium bg-[#1A56DB] text-white rounded-lg hover:bg-[#1A4FBF] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Log Activity
        </button>
        <button
          onClick={() => setShowBookDemo(true)}
          disabled={lead.phase === 'closer' || lead.status === 'demo_booked'}
          className="flex-1 py-1.5 text-xs font-medium bg-[#059669] text-white rounded-lg hover:bg-[#047857] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Book Demo
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#E2E8F0]">
        {(['overview', 'comments', 'contacts'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 py-2.5 text-xs font-medium capitalize transition-colors',
              tab === t ? 'text-[#1A56DB] border-b-2 border-[#1A56DB]' : 'text-[#64748B] hover:text-[#0F172A]'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-5">
        {tab === 'overview' && (
          <div className="space-y-3 text-sm">
            <Field label="Website" value={org?.url ? <a href={org.url} target="_blank" rel="noreferrer" className="text-[#1A56DB] hover:underline">{org.url}</a> : '—'} />
            <Field label="LinkedIn" value={org?.linkedin_url ?? '—'} />
            <Field label="Team Size" value={org?.team_size ? `${org.team_size} people` : '—'} />
            <Field label="Age" value={org?.age_years ? `${org.age_years} years` : '—'} />
            <Field label="Thematic Areas" value={org?.thematic_areas?.join(', ') ?? '—'} />
            <Field label="Follow-up Date" value={lead.follow_up_date ?? '—'} />
            <Field label="Callback Date" value={lead.callback_date ?? '—'} />
            <Field label="Recycle Reason" value={lead.recycle_reason ?? '—'} />
          </div>
        )}

        {tab === 'comments' && (
          <div className="flex flex-col gap-3">
            {/* Post new comment */}
            <div className="flex gap-2 items-start">
              <textarea
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) postComment()
                }}
                placeholder="Add a note or comment... (⌘Enter to post)"
                rows={2}
                className="flex-1 px-3 py-2 text-xs border border-[#E2E8F0] rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20 focus:border-[#1A56DB]"
              />
              <button
                onClick={postComment}
                disabled={postingComment || !commentText.trim()}
                className="p-2 bg-[#1A56DB] text-white rounded-lg hover:bg-[#1A4FBF] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                title="Post comment"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Comments list — latest on top */}
            {comments.length === 0 && (
              <p className="text-xs text-[#94A3B8] text-center py-4">No comments yet. Add your first note above.</p>
            )}
            {comments.map((c: any) => (
              <div key={c.id} className="bg-[#F8FAFC] rounded-xl p-3 border border-[#F1F5F9]">
                <p className="text-xs text-[#0F172A] leading-relaxed">{c.comment}</p>
                <p className="text-[10px] text-[#94A3B8] mt-1.5">
                  {c.user?.name ?? 'You'} · {new Date(c.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}
                </p>
              </div>
            ))}
          </div>
        )}

        {tab === 'contacts' && (
          <div className="space-y-3">
            {contacts.length === 0 && <p className="text-sm text-[#94A3B8]">No contacts on record.</p>}
            {contacts.map((c: any) => (
              <div key={c.id} className="bg-[#F8FAFC] rounded-lg p-3 border border-[#E2E8F0]">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-medium text-[#0F172A]">{c.name}</p>
                  {c.is_primary && <span className="text-[10px] bg-[#1A56DB] text-white px-1.5 py-0.5 rounded-full">PRIMARY</span>}
                </div>
                <p className="text-xs text-[#64748B]">{c.designation}</p>
                <div className="flex gap-3 mt-1.5 text-xs text-[#94A3B8]">
                  {c.phone && <span>{c.phone}</span>}
                  {c.email && <span>{c.email}</span>}
                  {c.linkedin_url && (
                    <a href={c.linkedin_url} target="_blank" rel="noreferrer" className="text-[#1A56DB] hover:underline">LinkedIn</a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Log Activity Modal */}
      {showLogActivity && (
        <LogActivityModal
          leadId={lead.id}
          onClose={() => setShowLogActivity(false)}
          onSuccess={() => { setShowLogActivity(false); onRefresh() }}
        />
      )}

      {/* Book Demo Modal */}
      {showBookDemo && (
        <BookDemoModal
          lead={lead}
          contacts={contacts}
          onClose={() => setShowBookDemo(false)}
          onSuccess={() => { setShowBookDemo(false); onDemoBooked(lead.id) }}
        />
      )}

      {/* Edit Lead Modal */}
      {showEditLead && (
        <EditLeadModal
          lead={lead}
          contacts={contacts}
          onClose={() => setShowEditLead(false)}
          onSuccess={() => { setShowEditLead(false); onRefresh() }}
        />
      )}
    </div>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8] w-28 shrink-0 mt-0.5">{label}</span>
      <span className="text-sm text-[#0F172A]">{value}</span>
    </div>
  )
}

// ── Edit Lead Modal ───────────────────────────────────────────────────────────
function EditLeadModal({
  lead,
  contacts,
  onClose,
  onSuccess,
}: {
  lead: LeadWithOrg
  contacts: any[]
  onClose: () => void
  onSuccess: () => void
}) {
  const org = lead.organization
  const primaryContact = contacts.find(c => c.is_primary) ?? contacts[0]

  // Org fields
  const [orgName,     setOrgName]     = useState(org?.name ?? '')
  const [location,    setLocation]    = useState(org?.location ?? '')
  const [orgUrl,      setOrgUrl]      = useState(org?.url ?? '')
  const [orgLinkedin, setOrgLinkedin] = useState(org?.linkedin_url ?? '')
  const [thematicAreas, setThematicAreas] = useState<string[]>(org?.thematic_areas ?? [])
  const [thematicInput, setThematicInput] = useState('')

  // KDM contact fields
  const [kdmName,        setKdmName]        = useState(primaryContact?.name ?? '')
  const [kdmDesignation, setKdmDesignation] = useState(primaryContact?.designation ?? '')
  const [kdmPhone,       setKdmPhone]       = useState(primaryContact?.phone ?? '')
  const [kdmEmail,       setKdmEmail]       = useState(primaryContact?.email ?? '')
  const [kdmLinkedin,    setKdmLinkedin]    = useState(primaryContact?.linkedin_url ?? '')

  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  function addThematicTag(raw: string) {
    const tags = raw.split(',').map(t => t.trim()).filter(Boolean)
    setThematicAreas(prev => {
      const merged = [...prev]
      tags.forEach(t => { if (!merged.includes(t)) merged.push(t) })
      return merged
    })
    setThematicInput('')
  }

  function handleThematicKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      if (thematicInput.trim()) addThematicTag(thematicInput)
    } else if (e.key === 'Backspace' && !thematicInput && thematicAreas.length > 0) {
      setThematicAreas(prev => prev.slice(0, -1))
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (thematicInput.trim()) addThematicTag(thematicInput)
    setError(''); setSaving(true)

    const results = await Promise.allSettled([
      // Update org
      fetch(`/api/organizations/${org.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: orgName.trim(),
          location: location.trim() || null,
          url: orgUrl.trim() || null,
          linkedin_url: orgLinkedin.trim() || null,
          thematic_areas: thematicAreas.length > 0 ? thematicAreas : null,
        }),
      }),
      // Update primary contact (if exists)
      primaryContact ? fetch(`/api/contacts/${primaryContact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: kdmName.trim(),
          designation: kdmDesignation.trim() || null,
          phone: kdmPhone.trim() || null,
          email: kdmEmail.trim() || null,
          linkedin_url: kdmLinkedin.trim() || null,
        }),
      }) : Promise.resolve(null),
    ])

    const failed = results.filter(r => r.status === 'rejected')
    if (failed.length > 0) {
      setError('Some fields failed to save. Please try again.')
      setSaving(false)
      return
    }

    // Check HTTP errors
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value && !result.value.ok) {
        const d = await result.value.json()
        setError(d.error ?? 'Save failed')
        setSaving(false)
        return
      }
    }

    setSaving(false)
    onSuccess()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="font-semibold text-[#0F172A] text-base">Edit Lead</h3>
            <p className="text-xs text-[#64748B] mt-0.5">Update org details and KDM contact</p>
          </div>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#64748B] text-xl leading-none">×</button>
        </div>

        <form onSubmit={submit} className="space-y-4">

          {/* ── Organisation ─────────────────────────────────────────────── */}
          <div className="space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8]">Organisation</p>

            <div>
              <label className="block text-xs text-[#64748B] mb-1">Name <span className="text-red-500">*</span></label>
              <input
                required
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#64748B] mb-1">Location</label>
                <input value={location} onChange={e => setLocation(e.target.value)} placeholder="City, State" className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20" />
              </div>
              <div>
                <label className="block text-xs text-[#64748B] mb-1">Website</label>
                <input value={orgUrl} onChange={e => setOrgUrl(e.target.value)} placeholder="https://..." className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20" />
              </div>
            </div>

            <div>
              <label className="block text-xs text-[#64748B] mb-1">LinkedIn URL</label>
              <input value={orgLinkedin} onChange={e => setOrgLinkedin(e.target.value)} placeholder="https://linkedin.com/company/..." className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20" />
            </div>

            <div>
              <label className="block text-xs text-[#64748B] mb-1">
                Thematic Areas <span className="text-[#94A3B8] font-normal">(Enter or comma to add)</span>
              </label>
              <div
                className="flex flex-wrap gap-1.5 px-3 py-2 border border-[#E2E8F0] rounded-lg min-h-[38px] cursor-text focus-within:ring-2 focus-within:ring-[#1A56DB]/20 focus-within:border-[#1A56DB]"
                onClick={e => (e.currentTarget.querySelector('input') as HTMLInputElement)?.focus()}
              >
                {thematicAreas.map(tag => (
                  <span key={tag} className="flex items-center gap-1 bg-[#EFF6FF] text-[#1A56DB] text-[11px] font-medium px-2 py-0.5 rounded-full">
                    {tag}
                    <button type="button" onClick={() => setThematicAreas(prev => prev.filter(t => t !== tag))} className="text-[#93C5FD] hover:text-[#1A56DB] leading-none">×</button>
                  </span>
                ))}
                <input
                  value={thematicInput}
                  onChange={e => setThematicInput(e.target.value)}
                  onKeyDown={handleThematicKeyDown}
                  onBlur={() => { if (thematicInput.trim()) addThematicTag(thematicInput) }}
                  placeholder={thematicAreas.length === 0 ? 'e.g. Education, Health...' : ''}
                  className="flex-1 min-w-[80px] text-sm outline-none bg-transparent"
                />
              </div>
            </div>
          </div>

          {/* ── Key Decision Maker ───────────────────────────────────────── */}
          {primaryContact && (
            <div className="space-y-3 pt-2 border-t border-[#F1F5F9]">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8]">Key Decision Maker</p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#64748B] mb-1">Name</label>
                  <input value={kdmName} onChange={e => setKdmName(e.target.value)} className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20" />
                </div>
                <div>
                  <label className="block text-xs text-[#64748B] mb-1">Designation</label>
                  <input value={kdmDesignation} onChange={e => setKdmDesignation(e.target.value)} placeholder="CEO, CFO..." className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#64748B] mb-1">Phone</label>
                  <input value={kdmPhone} onChange={e => setKdmPhone(e.target.value)} className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20" />
                </div>
                <div>
                  <label className="block text-xs text-[#64748B] mb-1">Email</label>
                  <input type="email" value={kdmEmail} onChange={e => setKdmEmail(e.target.value)} className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20" />
                </div>
              </div>

              <div>
                <label className="block text-xs text-[#64748B] mb-1">LinkedIn URL</label>
                <input value={kdmLinkedin} onChange={e => setKdmLinkedin(e.target.value)} placeholder="https://linkedin.com/in/..." className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20" />
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={saving || !orgName.trim()}
              className="flex-1 py-2.5 bg-[#1A56DB] text-white text-sm font-medium rounded-xl hover:bg-[#1e40af] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button type="button" onClick={onClose} className="py-2.5 px-4 border border-[#E2E8F0] text-sm text-[#64748B] rounded-xl hover:bg-[#F8FAFC]">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function LogActivityModal({ leadId, onClose, onSuccess }: { leadId: string; onClose: () => void; onSuccess: () => void }) {
  const [channel, setChannel] = useState('Cold Call')
  const [outcome, setOutcome] = useState('Call Again')
  const [signal, setSignal] = useState('warm')
  const [notes, setNotes] = useState('')
  const [callbackDate, setCallbackDate] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (notes.trim().length < 10) return alert('Notes must be at least 10 characters')
    setSaving(true)
    const res = await fetch('/api/activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lead_id: leadId, activity_type: 'call',
        channel, outcome, notes, interest_signal: signal,
        callback_date: outcome === 'Call Again' ? callbackDate : null,
      }),
    })
    if (res.ok) onSuccess()
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h3 className="font-semibold text-[#0F172A] mb-4">Log Activity</h3>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#64748B] mb-1">Channel</label>
            <select value={channel} onChange={e => setChannel(e.target.value)} className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20">
              {['Cold Call','Cold Email','LinkedIn','WhatsApp','Referral'].map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#64748B] mb-1">Outcome</label>
            <select value={outcome} onChange={e => setOutcome(e.target.value)} className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20">
              {['Not Interested','Call Again','Not Reachable','Other'].map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#64748B] mb-1">Interest Signal</label>
            <select value={signal} onChange={e => setSignal(e.target.value)} className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20">
              {['hot','warm','cold','dead'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
          {outcome === 'Call Again' && (
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#64748B] mb-1">Callback Date</label>
              <input type="date" value={callbackDate} onChange={e => setCallbackDate(e.target.value)} required className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20" />
            </div>
          )}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#64748B] mb-1">Conversation Notes <span className="text-red-500">*</span></label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} required rows={3} placeholder="What happened in this conversation? (min 10 chars)" className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20 resize-none" />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving} className="flex-1 py-2 bg-[#1A56DB] text-white text-sm font-medium rounded-lg hover:bg-[#1A4FBF] disabled:opacity-60">
              {saving ? 'Saving...' : 'Log Activity'}
            </button>
            <button type="button" onClick={onClose} className="py-2 px-4 border border-[#E2E8F0] text-sm text-[#64748B] rounded-lg hover:bg-[#F8FAFC]">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function BookDemoModal({ lead, contacts, onClose, onSuccess }: { lead: LeadWithOrg; contacts: any[]; onClose: () => void; onSuccess: () => void }) {
  const [demoDate, setDemoDate] = useState('')
  const [painPoint, setPainPoint] = useState('')
  const [demoExpectation, setDemoExpectation] = useState('')
  const [extraNotes, setExtraNotes] = useState('')
  const [signal, setSignal] = useState('warm')
  const [closerId, setCloserId] = useState('')
  const [closers, setClosers] = useState<{ id: string; name: string }[]>([])
  const [saving, setSaving] = useState(false)
  const org = lead.organization
  const primaryContact = contacts.find(c => c.is_primary) ?? contacts[0]

  const canSubmit = painPoint.trim().length >= 5 && demoExpectation.trim().length >= 5 && !!closerId && !!demoDate

  // Fetch active closers when modal opens — uses /api/closers (open to all authenticated users)
  useEffect(() => {
    fetch('/api/closers')
      .then(r => r.json())
      .then(data => {
        const activeClosers = Array.isArray(data) ? data : []
        setClosers(activeClosers)
        if (activeClosers.length === 1) setCloserId(activeClosers[0].id)
      })
      .catch(() => setClosers([]))
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSaving(true)
    const res = await fetch('/api/demos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lead_id: lead.id, org_id: lead.org_id,
        demo_date: demoDate,
        pain_point: painPoint.trim(),
        demo_expectation: demoExpectation.trim(),
        sdr_summary: extraNotes.trim() || null,
        sdr_interest_signal: signal,
        closer_id: closerId,
      }),
    })
    if (res.ok) onSuccess()
    else {
      const data = await res.json()
      alert(data.error)
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-semibold text-[#0F172A] text-base">Book Demo</h3>
            <p className="text-xs text-[#64748B] mt-0.5">This will hand off the lead to the selected Closer</p>
          </div>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#64748B] text-xl leading-none">×</button>
        </div>

        {/* Org context — read only */}
        <div className="bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] p-3.5 mb-4 space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8]">Organisation</p>
          <p className="font-semibold text-[#0F172A] text-sm">{org?.name}</p>
          <div className="flex flex-wrap gap-3 text-xs text-[#64748B]">
            {org?.location && <span>{org.location}</span>}
            {org?.url && <a href={org.url} target="_blank" rel="noreferrer" className="text-[#1A56DB] hover:underline">{org.url}</a>}
            {org?.annual_revenue && <span>₹{(org.annual_revenue/100000).toFixed(0)}L revenue</span>}
            {org?.team_size && <span>{org.team_size} people</span>}
          </div>
          {primaryContact && (
            <div className="flex gap-3 text-xs text-[#64748B] pt-1 border-t border-[#E2E8F0] mt-1">
              <span className="font-medium text-[#0F172A]">KDM: {primaryContact.name}</span>
              {primaryContact.designation && <span>{primaryContact.designation}</span>}
              {primaryContact.phone && <span>{primaryContact.phone}</span>}
              {primaryContact.email && <span>{primaryContact.email}</span>}
            </div>
          )}
        </div>

        <form onSubmit={submit} className="space-y-3.5">
          {/* Demo date */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#64748B] mb-1">
              Demo Date & Time <span className="text-red-500">*</span>
            </label>
            <DateTimePicker
              value={demoDate}
              onChange={setDemoDate}
              placeholder="Pick demo date & time"
            />
          </div>

          {/* Closer selection */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#64748B] mb-1">
              Assign Closer <span className="text-red-500">*</span>
            </label>
            {closers.length === 0 ? (
              <p className="text-xs text-[#94A3B8] py-2">Loading closers...</p>
            ) : (
              <select
                value={closerId}
                onChange={e => setCloserId(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20"
              >
                <option value="">— Select a Closer —</option>
                {closers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Interest signal */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#64748B] mb-1">Interest Signal</label>
            <div className="flex gap-2">
              {[
                { value: 'hot', label: 'Hot', color: '#EF4444' },
                { value: 'warm', label: 'Warm', color: '#F59E0B' },
                { value: 'cold', label: 'Cold', color: '#64748B' },
              ].map(s => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setSignal(s.value)}
                  className={cn(
                    'flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-colors',
                    signal === s.value
                      ? 'text-white border-transparent'
                      : 'border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1]'
                  )}
                  style={signal === s.value ? { backgroundColor: s.color, borderColor: s.color } : {}}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Structured SDR context for Closer ── */}
          <div className="space-y-3 p-3.5 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">
              Context for Closer <span className="text-red-500">*</span>
            </p>

            {/* Pain Point */}
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1">
                What is their main pain point?
              </label>
              <textarea
                value={painPoint}
                onChange={e => setPainPoint(e.target.value)}
                required
                rows={2}
                placeholder="e.g. They struggle with donor retention and want tools to improve repeat giving rates."
                className={cn(
                  'w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 resize-none',
                  painPoint.length > 0 && painPoint.trim().length < 5
                    ? 'border-red-300 focus:ring-red-200/20'
                    : 'border-[#E2E8F0] focus:ring-[#1A56DB]/20'
                )}
              />
            </div>

            {/* Demo Expectation */}
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1">
                What are they expecting from the demo?
              </label>
              <textarea
                value={demoExpectation}
                onChange={e => setDemoExpectation(e.target.value)}
                required
                rows={2}
                placeholder="e.g. They want to see the reporting dashboard and how it integrates with their existing CRM."
                className={cn(
                  'w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 resize-none',
                  demoExpectation.length > 0 && demoExpectation.trim().length < 5
                    ? 'border-red-300 focus:ring-red-200/20'
                    : 'border-[#E2E8F0] focus:ring-[#1A56DB]/20'
                )}
              />
            </div>

            {/* Optional extra notes */}
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1">
                Anything else the closer should know? <span className="font-normal text-[#94A3B8]">(optional)</span>
              </label>
              <textarea
                value={extraNotes}
                onChange={e => setExtraNotes(e.target.value)}
                rows={2}
                placeholder="Budget signals, decision timeline, key stakeholders, objections to address..."
                className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20 resize-none"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={saving || !canSubmit}
              className="flex-1 py-2 bg-[#059669] text-white text-sm font-medium rounded-lg hover:bg-[#047857] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Booking...' : 'Confirm Demo Booking'}
            </button>
            <button type="button" onClick={onClose} className="py-2 px-4 border border-[#E2E8F0] text-sm text-[#64748B] rounded-lg hover:bg-[#F8FAFC]">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
