'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, X, Loader2, CheckCircle2, AlertCircle, MapPin, Tag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ORG_STATUS_CONFIG } from './OrgSearchInput'
import type { OrgSearchResult } from '@/app/api/organizations/search/route'

interface OrgSearchModalProps {
  role: 'sdr' | 'closer' | 'admin'
  onClose: () => void
}

export default function OrgSearchModal({ role, onClose }: OrgSearchModalProps) {
  const [query,         setQuery]         = useState('')
  const [results,       setResults]       = useState<OrgSearchResult[]>([])
  const [loading,       setLoading]       = useState(false)
  const [hasSearched,   setHasSearched]   = useState(false)

  // Claim state — maps org.id → 'requesting' | 'done' | Error message
  const [claimState,    setClaimState]    = useState<Record<string, 'requesting' | 'done' | string>>({})
  const [claimNotes,    setClaimNotes]    = useState<Record<string, string>>({})

  // Data enrichment request
  const [showEnrich,    setShowEnrich]    = useState(false)
  const [enrichName,    setEnrichName]    = useState('')
  const [enrichNote,    setEnrichNote]    = useState('')
  const [enrichDone,    setEnrichDone]    = useState(false)
  const [enrichError,   setEnrichError]   = useState('')
  const [enrichSaving,  setEnrichSaving]  = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef    = useRef<HTMLInputElement>(null)

  // Auto-focus on open
  useEffect(() => { inputRef.current?.focus() }, [])

  // Close on Escape
  useEffect(() => {
    function handle(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [onClose])

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query || query.length < 2) {
      setResults([])
      setHasSearched(false)
      return
    }
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

  async function requestAssignment(org: OrgSearchResult) {
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

  async function submitEnrichRequest() {
    if (!enrichName.trim()) return
    setEnrichSaving(true)
    setEnrichError('')
    try {
      const res = await fetch('/api/lead-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_type: 'data_enrichment',
          org_name_requested: enrichName.trim(),
          sdr_notes: enrichNote.trim() || undefined,
        }),
      })
      if (res.ok) {
        setEnrichDone(true)
      } else {
        const d = await res.json()
        setEnrichError(d.error ?? 'Failed to submit request')
      }
    } catch { setEnrichError('Network error') }
    setEnrichSaving(false)
  }

  const showEnrichSection = role === 'sdr' && hasSearched

  return (
    <div
      className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-[2px] z-50 flex items-start justify-center pt-[8vh] px-4"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">

        {/* ── Header ─────────────────────────────────────── */}
        <div className="px-4 pt-4 pb-3 border-b border-[#F1F5F9] shrink-0">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8] pointer-events-none" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search organisations by name..."
                className="w-full pl-9 pr-8 py-2.5 text-sm border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20 focus:border-[#1A56DB]"
              />
              {loading && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-[#94A3B8] pointer-events-none" />
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-[#F1F5F9] text-[#94A3B8] transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[10px] text-[#94A3B8] mt-2 px-0.5">
            {role === 'sdr'
              ? 'Check if an org is already in the system before adding it manually.'
              : 'Look up an organisation\'s status and pipeline position.'}
          </p>
        </div>

        {/* ── Results ────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* Empty / idle states */}
          {!hasSearched && !loading && (
            <div className="py-12 text-center">
              <p className="text-[12px] text-[#94A3B8]">Type at least 2 characters to search</p>
            </div>
          )}

          {hasSearched && results.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-[13px] font-medium text-[#374151]">No organisations found</p>
              <p className="text-[11px] text-[#94A3B8] mt-1">
                {role === 'sdr' ? 'Try a different spelling, or request data enrichment below.' : 'Try a different search term.'}
              </p>
            </div>
          )}

          {/* Results list */}
          {results.length > 0 && (
            <div className="divide-y divide-[#F1F5F9]">
              {results.map(org => {
                const cfg   = ORG_STATUS_CONFIG[org.status] ?? ORG_STATUS_CONFIG.in_database
                const claim = claimState[org.id]

                return (
                  <div key={org.id} className="px-4 py-3.5">
                    {/* Org info row */}
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-[13px] font-semibold text-[#0F172A]">{org.name}</span>
                          <span className={cn('shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full', cfg.className)}>
                            {cfg.label}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-[#94A3B8]">
                          {org.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {org.location}
                            </span>
                          )}
                          {org.assignee_name && (
                            <span>
                              {org.assignee_role === 'sdr' ? 'SDR' : 'Closer'}: {org.assignee_name}
                            </span>
                          )}
                          {org.deal_stage && (
                            <span>Stage: {org.deal_stage.replace(/_/g, ' ')}</span>
                          )}
                        </div>

                        {org.thematic_areas && org.thematic_areas.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {org.thematic_areas.slice(0, 5).map(t => (
                              <span key={t} className="flex items-center gap-1 text-[10px] bg-[#EFF6FF] text-[#1A56DB] px-1.5 py-0.5 rounded-full">
                                <Tag className="w-2.5 h-2.5" />
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* SDR: Request Assignment button for lead_pool orgs */}
                    {role === 'sdr' && org.status === 'in_lead_pool' && (
                      <div className="mt-2.5">
                        {!claim && (
                          <div className="space-y-2">
                            <input
                              value={claimNotes[org.id] ?? ''}
                              onChange={e => setClaimNotes(n => ({ ...n, [org.id]: e.target.value }))}
                              placeholder="Add a note for admin (optional)"
                              className="w-full px-3 py-1.5 text-xs border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20"
                            />
                            <button
                              onClick={() => requestAssignment(org)}
                              className="px-3 py-1.5 bg-[#1A56DB] text-white text-[11px] font-semibold rounded-lg hover:bg-[#1e40af] transition-colors"
                            >
                              Request Assignment
                            </button>
                          </div>
                        )}
                        {claim === 'requesting' && (
                          <p className="text-[11px] text-[#64748B] flex items-center gap-1.5">
                            <Loader2 className="w-3 h-3 animate-spin" /> Submitting…
                          </p>
                        )}
                        {claim === 'done' && (
                          <p className="text-[11px] text-[#065F46] font-medium flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Assignment request submitted
                          </p>
                        )}
                        {claim && claim !== 'requesting' && claim !== 'done' && (
                          <p className="text-[11px] text-red-500 flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5" /> {claim}
                          </p>
                        )}
                      </div>
                    )}

                    {/* SDR: context message for non-pool orgs */}
                    {role === 'sdr' && org.status !== 'in_lead_pool' && org.status !== 'in_database' && (
                      <p className="mt-1.5 text-[10px] text-[#94A3B8] italic">
                        {org.status === 'active_client' && 'This organisation is already a DaanVeda client.'}
                        {org.status === 'with_sdr' && `Being worked by ${org.assignee_name ?? 'another SDR'}.`}
                        {org.status === 'demo_booked' && 'A demo has been booked for this org.'}
                        {org.status === 'in_pipeline' && `In Closer's pipeline${org.deal_stage ? ` · ${org.deal_stage.replace(/_/g, ' ')}` : ''}.`}
                        {(org.status === 'lost' || org.status === 'ghosted') && 'Previously worked — contact admin to re-engage.'}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── SDR: Data Enrichment section ───────────────── */}
        {showEnrichSection && (
          <div className="shrink-0 border-t border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3.5">
            {enrichDone ? (
              <div className="flex items-center gap-2 text-[#065F46] text-[12px] font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                Data enrichment request submitted. Admin will be notified.
              </div>
            ) : !showEnrich ? (
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-[#64748B]">
                  Can&apos;t find what you&apos;re looking for?
                </p>
                <button
                  onClick={() => { setShowEnrich(true); setEnrichName(query) }}
                  className="text-[11px] text-[#1A56DB] font-semibold hover:underline"
                >
                  Request data enrichment →
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-[#374151]">Request Data Enrichment</p>
                  <button onClick={() => setShowEnrich(false)} className="text-[#94A3B8] hover:text-[#64748B] text-sm leading-none">×</button>
                </div>
                <p className="text-[10px] text-[#94A3B8]">
                  Admin will research this org and add contact data to the system.
                </p>
                <input
                  value={enrichName}
                  onChange={e => setEnrichName(e.target.value)}
                  placeholder="Organisation name *"
                  className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20"
                />
                <textarea
                  value={enrichNote}
                  onChange={e => setEnrichNote(e.target.value)}
                  placeholder="Notes for admin (optional) — website, LinkedIn, known contact..."
                  rows={2}
                  className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20 resize-none"
                />
                {enrichError && (
                  <p className="text-[11px] text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {enrichError}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={submitEnrichRequest}
                    disabled={!enrichName.trim() || enrichSaving}
                    className="flex-1 py-2 bg-[#0F172A] text-white text-[11px] font-semibold rounded-lg hover:bg-[#1E293B] disabled:opacity-40 transition-colors"
                  >
                    {enrichSaving ? 'Submitting…' : 'Submit Request'}
                  </button>
                  <button
                    onClick={() => setShowEnrich(false)}
                    className="px-4 py-2 text-[11px] text-[#64748B] border border-[#E2E8F0] rounded-lg hover:bg-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
