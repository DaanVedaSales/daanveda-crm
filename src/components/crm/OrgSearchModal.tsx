'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, X, Loader2, CheckCircle2, AlertCircle, MapPin, Tag, Globe, Linkedin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ORG_STATUS_CONFIG } from './OrgSearchInput'
import type { OrgSearchResult } from '@/app/api/organizations/search/route'

interface OrgSearchModalProps {
  role: 'sdr' | 'closer' | 'admin'
  onClose: () => void
}

// ── Enrichment Dialog (overlay within the modal) ─────────────────────────────
interface EnrichDialogProps {
  prefillName: string
  onClose: () => void
  onSuccess: () => void
}

function EnrichDialog({ prefillName, onClose, onSuccess }: EnrichDialogProps) {
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')
  const [form, setForm] = useState({
    orgName:           prefillName,
    location:          '',
    website:           '',
    orgLinkedin:       '',
    contactName:       '',
    contactDesig:      '',
    contactLinkedin:   '',
    comment:           '',
  })

  function set(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value }))
  }

  async function submit() {
    if (!form.orgName.trim() || !form.location.trim()) return
    setSaving(true)
    setError('')

    // Bundle all fields into sdr_notes as readable structured text
    const parts: string[] = []
    if (form.location)        parts.push(`Location: ${form.location}`)
    if (form.website)         parts.push(`Website: ${form.website}`)
    if (form.orgLinkedin)     parts.push(`Org LinkedIn: ${form.orgLinkedin}`)
    if (form.contactName)     parts.push(`Contact: ${form.contactName}`)
    if (form.contactDesig)    parts.push(`Designation: ${form.contactDesig}`)
    if (form.contactLinkedin) parts.push(`Contact LinkedIn: ${form.contactLinkedin}`)
    if (form.comment)         parts.push(`Note: ${form.comment}`)

    try {
      const res = await fetch('/api/lead-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_type:       'data_enrichment',
          org_name_requested: form.orgName.trim(),
          sdr_notes:          parts.join(' · ') || undefined,
        }),
      })
      if (res.ok) {
        onSuccess()
      } else {
        const d = await res.json()
        setError(d.error ?? 'Failed to submit request')
      }
    } catch { setError('Network error — try again') }
    setSaving(false)
  }

  const canSubmit = form.orgName.trim().length > 0 && form.location.trim().length > 0

  return (
    // Full-screen overlay on top of the search modal
    <div className="absolute inset-0 bg-white rounded-2xl flex flex-col z-10">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#F1F5F9] flex items-center justify-between shrink-0">
        <div>
          <p className="text-[14px] font-semibold text-[#0F172A]">Request Data Enrichment</p>
          <p className="text-[10px] text-[#94A3B8] mt-0.5">
            Admin will research this org and add contact data to the system.
          </p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#94A3B8] transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

        {/* Organisation section */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8] mb-2">Organisation</p>
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-medium text-[#374151] mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  value={form.orgName}
                  onChange={set('orgName')}
                  placeholder="Organisation name"
                  className="w-full px-3 py-2 text-[12px] border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20 focus:border-[#1A56DB]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[#374151] mb-1">
                  Location <span className="text-red-500">*</span>
                </label>
                <input
                  value={form.location}
                  onChange={set('location')}
                  placeholder="e.g. Mumbai, Maharashtra"
                  className="w-full px-3 py-2 text-[12px] border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20 focus:border-[#1A56DB]"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-medium text-[#374151] mb-1 flex items-center gap-1">
                  <Globe className="w-3 h-3 text-[#94A3B8]" /> Website
                  <span className="text-[#CBD5E1] font-normal">(optional)</span>
                </label>
                <input
                  value={form.website}
                  onChange={set('website')}
                  placeholder="www.example.org"
                  className="w-full px-3 py-2 text-[12px] border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20 focus:border-[#1A56DB]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[#374151] mb-1 flex items-center gap-1">
                  <Linkedin className="w-3 h-3 text-[#94A3B8]" /> Org LinkedIn
                  <span className="text-[#CBD5E1] font-normal">(optional)</span>
                </label>
                <input
                  value={form.orgLinkedin}
                  onChange={set('orgLinkedin')}
                  placeholder="linkedin.com/company/..."
                  className="w-full px-3 py-2 text-[12px] border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20 focus:border-[#1A56DB]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Contact Person section */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8] mb-2">
            Contact Person <span className="normal-case font-normal text-[#CBD5E1]">— optional</span>
          </p>
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-medium text-[#374151] mb-1">Name</label>
                <input
                  value={form.contactName}
                  onChange={set('contactName')}
                  placeholder="e.g. Ravi Sharma"
                  className="w-full px-3 py-2 text-[12px] border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20 focus:border-[#1A56DB]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[#374151] mb-1">Designation</label>
                <input
                  value={form.contactDesig}
                  onChange={set('contactDesig')}
                  placeholder="e.g. Program Director"
                  className="w-full px-3 py-2 text-[12px] border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20 focus:border-[#1A56DB]"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[#374151] mb-1 flex items-center gap-1">
                <Linkedin className="w-3 h-3 text-[#94A3B8]" /> Contact LinkedIn
              </label>
              <input
                value={form.contactLinkedin}
                onChange={set('contactLinkedin')}
                placeholder="linkedin.com/in/..."
                className="w-full px-3 py-2 text-[12px] border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20 focus:border-[#1A56DB]"
              />
            </div>
          </div>
        </div>

        {/* Comment */}
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8] mb-2">
            Comment for Sales Ops <span className="normal-case font-normal text-[#CBD5E1]">— optional</span>
          </label>
          <textarea
            value={form.comment}
            onChange={set('comment')}
            placeholder="Any context that helps the team research this org faster..."
            rows={2}
            className="w-full px-3 py-2 text-[12px] border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20 focus:border-[#1A56DB] resize-none"
          />
        </div>

        {error && (
          <p className="text-[11px] text-red-500 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 px-5 py-3.5 border-t border-[#F1F5F9] flex gap-2.5">
        <button
          onClick={submit}
          disabled={!canSubmit || saving}
          className="flex-1 py-2.5 bg-[#0F172A] text-white text-[12px] font-semibold rounded-xl hover:bg-[#1E293B] disabled:opacity-40 transition-colors"
        >
          {saving ? 'Submitting…' : 'Submit Request'}
        </button>
        <button
          onClick={onClose}
          className="px-5 py-2.5 text-[12px] text-[#64748B] border border-[#E2E8F0] rounded-xl hover:bg-[#F8FAFC] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Main OrgSearchModal ───────────────────────────────────────────────────────
export default function OrgSearchModal({ role, onClose }: OrgSearchModalProps) {
  const [query,       setQuery]       = useState('')
  const [results,     setResults]     = useState<OrgSearchResult[]>([])
  const [loading,     setLoading]     = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  // Claim state — maps org.id → 'requesting' | 'done' | error string
  const [claimState, setClaimState] = useState<Record<string, 'requesting' | 'done' | string>>({})
  const [claimNotes, setClaimNotes] = useState<Record<string, string>>({})

  // Enrichment dialog
  const [showEnrich,  setShowEnrich]  = useState(false)
  const [enrichDone,  setEnrichDone]  = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef    = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    function handle(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (showEnrich) { setShowEnrich(false); return }
        onClose()
      }
    }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [onClose, showEnrich])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query || query.length < 2) { setResults([]); setHasSearched(false); return }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      setHasSearched(false)
      try {
        const res = await fetch(`/api/organizations/search?q=${encodeURIComponent(query)}&limit=10`)
        if (res.ok) {
          const data = await res.json()
          setResults(Array.isArray(data) ? data : [])
        }
      } catch { setResults([]) }
      setHasSearched(true)
      setLoading(false)
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  async function claimLead(org: OrgSearchResult) {
    const note = claimNotes[org.id] ?? ''
    setClaimState(s => ({ ...s, [org.id]: 'requesting' }))
    try {
      const res = await fetch('/api/lead-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_type: 'lead_pool', org_id: org.id, sdr_notes: note || undefined }),
      })
      if (res.ok) {
        setClaimState(s => ({ ...s, [org.id]: 'done' }))
      } else {
        const d = await res.json()
        setClaimState(s => ({ ...s, [org.id]: d.error ?? 'Request failed' }))
      }
    } catch {
      setClaimState(s => ({ ...s, [org.id]: 'Network error — try again' }))
    }
  }

  const showEnrichTrigger = role === 'sdr' && hasSearched && !enrichDone

  return (
    <div
      className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-[2px] z-50 flex items-start justify-center pt-[8vh] px-4"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[82vh]">

        {/* ── Enrichment dialog overlaid on top ─────── */}
        {showEnrich && (
          <EnrichDialog
            prefillName={query}
            onClose={() => setShowEnrich(false)}
            onSuccess={() => { setShowEnrich(false); setEnrichDone(true) }}
          />
        )}

        {/* ── Search header ─────────────────────────── */}
        <div className="px-4 pt-4 pb-3 border-b border-[#F1F5F9] shrink-0">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8] pointer-events-none" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search organisations by name…"
                className="w-full pl-9 pr-8 py-2.5 text-sm border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20 focus:border-[#1A56DB]"
              />
              {loading && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-[#94A3B8] pointer-events-none" />
              )}
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#F1F5F9] text-[#94A3B8] transition-colors shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[10px] text-[#94A3B8] mt-2 px-0.5">
            {role === 'sdr'
              ? 'Check if an org is already in the system before adding it manually.'
              : 'Look up an organisation\'s status and pipeline position.'}
          </p>
        </div>

        {/* ── Results ───────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {!hasSearched && !loading && (
            <div className="py-12 text-center">
              <p className="text-[12px] text-[#94A3B8]">Type at least 2 characters to search</p>
            </div>
          )}

          {hasSearched && results.length === 0 && (
            <div className="py-10 text-center px-6">
              <p className="text-[13px] font-medium text-[#374151]">No organisations found</p>
              <p className="text-[11px] text-[#94A3B8] mt-1">
                {role === 'sdr'
                  ? 'Try a different spelling, or use "Request Data Enrichment" below to flag it for the team.'
                  : 'Try a different search term.'}
              </p>
            </div>
          )}

          {results.length > 0 && (
            <div className="divide-y divide-[#F8FAFC]">
              {results.map(org => {
                const cfg   = ORG_STATUS_CONFIG[org.status] ?? ORG_STATUS_CONFIG.in_database
                const claim = claimState[org.id]

                return (
                  <div key={org.id} className="px-4 py-3.5">

                    {/* Org info row */}
                    <div className="flex items-start gap-2 flex-wrap mb-1">
                      <span className="text-[13px] font-semibold text-[#0F172A] leading-tight">{org.name}</span>
                      <span className={cn('shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full', cfg.className)}>
                        {cfg.label}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-[#94A3B8] mb-1.5">
                      {org.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />{org.location}
                        </span>
                      )}
                      {org.assignee_name && (
                        <span className="font-medium text-[#475569]">
                          {org.assignee_role === 'sdr' ? 'SDR' : 'Closer'}: {org.assignee_name}
                        </span>
                      )}
                      {org.deal_stage && (
                        <span>Stage: {org.deal_stage.replace(/_/g, ' ')}</span>
                      )}
                    </div>

                    {org.thematic_areas && org.thematic_areas.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-1.5">
                        {org.thematic_areas.slice(0, 5).map(t => (
                          <span key={t} className="flex items-center gap-1 text-[10px] bg-[#EFF6FF] text-[#1A56DB] px-1.5 py-0.5 rounded-full">
                            <Tag className="w-2.5 h-2.5" />{t}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* ── SDR: Already claimed by another SDR ── */}
                    {role === 'sdr' && org.status === 'claim_pending' && (
                      <p className="mt-1.5 text-[11px] text-[#92400E] font-medium flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        Claimed by {org.assignee_name ?? 'an SDR'} · awaiting admin approval
                      </p>
                    )}

                    {/* ── SDR: Claim button for unassigned + in-database orgs ── */}
                    {role === 'sdr' && (org.status === 'in_lead_pool' || org.status === 'in_database') && (
                      <div className="mt-2">
                        {!claim && (
                          <div className="space-y-1.5">
                            <p className="text-[10px] text-[#94A3B8] italic">
                              {org.status === 'in_lead_pool'
                                ? 'This lead is unassigned — claim it and admin will assign it to you.'
                                : 'This org is in our database but has no active lead — claim it to get started.'}
                            </p>
                            <input
                              value={claimNotes[org.id] ?? ''}
                              onChange={e => setClaimNotes(n => ({ ...n, [org.id]: e.target.value }))}
                              placeholder="Add a note for admin (optional)"
                              className="w-full px-3 py-1.5 text-[11px] border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20"
                            />
                            <button
                              onClick={() => claimLead(org)}
                              className="px-3.5 py-1.5 bg-[#047857] text-white text-[11px] font-semibold rounded-lg hover:bg-[#065F46] transition-colors"
                            >
                              Claim →
                            </button>
                          </div>
                        )}
                        {claim === 'requesting' && (
                          <p className="text-[11px] text-[#64748B] flex items-center gap-1.5">
                            <Loader2 className="w-3 h-3 animate-spin" /> Submitting claim…
                          </p>
                        )}
                        {claim === 'done' && (
                          <p className="text-[11px] text-[#065F46] font-medium flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Claim submitted — admin will assign it to you
                          </p>
                        )}
                        {claim && claim !== 'requesting' && claim !== 'done' && (
                          <p className="text-[11px] text-red-500 flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5" /> {claim}
                          </p>
                        )}
                      </div>
                    )}

                    {/* ── SDR: context notes for locked statuses ── */}
                    {role === 'sdr' && !['in_lead_pool', 'in_database', 'claim_pending'].includes(org.status) && (
                      <p className="mt-1 text-[10px] text-[#94A3B8] italic">
                        {org.status === 'active_client'  && 'This organisation is already a DaanVeda client.'}
                        {org.status === 'with_sdr'       && `Being worked by ${org.assignee_name ?? 'another SDR'}.`}
                        {org.status === 'demo_booked'    && 'A demo has been booked for this org.'}
                        {org.status === 'in_pipeline'    && `In Closer's pipeline${org.deal_stage ? ` · ${org.deal_stage.replace(/_/g, ' ')}` : ''}.`}
                        {(org.status === 'lost' || org.status === 'ghosted') && 'Previously worked — contact admin to re-engage.'}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── SDR: enrichment trigger / success ─────── */}
        {role === 'sdr' && (hasSearched || enrichDone) && (
          <div className="shrink-0 border-t border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
            {enrichDone ? (
              <div className="flex items-center gap-2 text-[#065F46] text-[12px] font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                Enrichment request submitted — admin will be notified.
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-[#64748B]">Can't find the org you're looking for?</p>
                <button
                  onClick={() => setShowEnrich(true)}
                  className="text-[11px] text-[#1A56DB] font-semibold hover:underline"
                >
                  Request data enrichment →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
