'use client'

import { useState, useEffect, useRef } from 'react'
import TopBar from '@/components/layout/TopBar'
import { createClient } from '@/lib/supabase/client'
import { LEAD_STATUS_LABELS, LEAD_STATUS_COLORS } from '@/lib/constants'
import type { LeadStatus } from '@/types/database'
import { cn } from '@/lib/utils'
import { CheckCircle, ChevronDown, ChevronUp, Trash2, Send, MessageSquare } from 'lucide-react'
import DateTimePicker from '@/components/ui/DateTimePicker'

interface FollowupLead {
  id: string
  org_id: string
  status: LeadStatus
  callback_date: string | null
  follow_up_date: string | null
  updated_at: string | null
  organization: { name: string; location: string | null; url: string | null; annual_revenue: number | null; team_size: number | null }
}

// ── Expandable detail for a follow-up lead ────────────────────────────────────
function LeadExpandedDetail({
  leadId,
  onContactsLoaded,
  onBookDemo,
  onRescheduled,
  currentCallbackDate,
}: {
  leadId: string
  onContactsLoaded: (contacts: any[]) => void
  onBookDemo: () => void
  onRescheduled: () => void
  currentCallbackDate: string | null
}) {
  const [data, setData] = useState<{ contacts: any[]; activities: any[] } | null>(null)
  const [rescheduleDate, setRescheduleDate] = useState(currentCallbackDate?.split('T')[0] ?? '')
  const [rescheduling, setRescheduling] = useState(false)
  const [rescheduled, setRescheduled] = useState(false)
  // Follow-up specific comments
  const [comments, setComments] = useState<any[]>([])
  const [commentText, setCommentText] = useState('')
  const [postingComment, setPostingComment] = useState(false)

  useEffect(() => {
    fetch(`/api/leads/${leadId}`)
      .then(r => r.json())
      .then(d => {
        const contacts = d.contacts ?? []
        setData({ contacts, activities: d.activities ?? [] })
        onContactsLoaded(contacts)
      })
    // Load follow-up comments (source=followup only)
    fetch(`/api/leads/comments?lead_id=${leadId}&source=followup`)
      .then(r => r.json())
      .then(d => setComments(Array.isArray(d) ? d : []))
  }, [leadId])

  async function postFollowupComment() {
    if (!commentText.trim()) return
    setPostingComment(true)
    const res = await fetch('/api/leads/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_id: leadId, comment: commentText.trim(), source: 'followup' }),
    })
    if (res.ok) {
      const newComment = await res.json()
      setComments(prev => [newComment, ...prev])
      setCommentText('')
    }
    setPostingComment(false)
  }

  async function handleReschedule() {
    if (!rescheduleDate) return
    setRescheduling(true)
    const res = await fetch(`/api/leads/${leadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_date: rescheduleDate }),
    })
    setRescheduling(false)
    if (res.ok) {
      setRescheduled(true)
      setTimeout(() => onRescheduled(), 800)
    }
  }

  if (!data) {
    return <div className="px-5 pb-4"><div className="h-12 bg-[#F1F5F9] rounded-lg skeleton" /></div>
  }

  const primary = data.contacts.find((c: any) => c.is_primary) ?? data.contacts[0]

  return (
    <div className="px-5 pb-4 pt-2 border-t border-[#F1F5F9] space-y-3">
      {/* KDM Contact */}
      {primary && (
        <div className="bg-[#F8FAFC] rounded-xl p-3 border border-[#E2E8F0]">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8] mb-1.5">Key Decision Maker</p>
          <p className="text-sm font-medium text-[#0F172A]">{primary.name}</p>
          {primary.designation && <p className="text-xs text-[#64748B]">{primary.designation}</p>}
          <div className="flex gap-3 mt-1 text-xs text-[#64748B]">
            {primary.phone && <span>{primary.phone}</span>}
            {primary.email && <span>{primary.email}</span>}
          </div>
        </div>
      )}
      {!primary && <p className="text-xs text-[#94A3B8]">No contact on record.</p>}

      {/* Last contact — most recent activity only */}
      {data.activities.length > 0 && (
        <div className="bg-[#F8FAFC] rounded-xl p-3 border border-[#E2E8F0]">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8] mb-1.5">Last Contact</p>
          <div className="flex items-start gap-2">
            <span className="text-[10px] font-semibold text-[#1A56DB] bg-blue-50 border border-[#BFDBFE] px-1.5 py-0.5 rounded-full shrink-0 capitalize">
              {data.activities[0].channel ?? data.activities[0].activity_type.replace('_', ' ')}
            </span>
            <div className="flex-1 min-w-0">
              {data.activities[0].notes && (
                <p className="text-xs text-[#374151] leading-relaxed">{data.activities[0].notes}</p>
              )}
              <p className="text-[10px] text-[#94A3B8] mt-0.5">
                {new Date(data.activities[0].created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Next callback date — update inline */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8] mb-1.5">Next Callback</p>
        <div className="flex gap-2">
          <input
            type="date"
            value={rescheduleDate}
            onChange={e => { setRescheduleDate(e.target.value); setRescheduled(false) }}
            className="flex-1 px-3 py-1.5 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20 focus:border-[#1A56DB]"
          />
          <button
            onClick={handleReschedule}
            disabled={!rescheduleDate || rescheduling}
            className="px-3 py-1.5 text-xs font-semibold bg-[#0F172A] text-white rounded-lg hover:bg-[#1E293B] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {rescheduling ? '…' : rescheduled ? 'Saved' : 'Update'}
          </button>
        </div>
      </div>

      {/* Follow-up Notes */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8] mb-1.5 flex items-center gap-1.5">
          <MessageSquare className="w-3 h-3" strokeWidth={2} /> Follow-up Notes
        </p>

        {/* Post new note */}
        <div className="flex gap-2 items-start mb-2">
          <textarea
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) postFollowupComment() }}
            placeholder="What was discussed in this follow-up? (⌘Enter to save)"
            rows={2}
            className="flex-1 px-3 py-2 text-xs border border-[#E2E8F0] rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20 focus:border-[#1A56DB]"
          />
          <button
            onClick={postFollowupComment}
            disabled={postingComment || !commentText.trim()}
            className="p-2 bg-[#1A56DB] text-white rounded-lg hover:bg-[#1A4FBF] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
            title="Save note"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Notes list — latest on top */}
        {comments.length === 0 ? (
          <p className="text-[11px] text-[#94A3B8] text-center py-2">No follow-up notes yet.</p>
        ) : (
          <div className="space-y-1.5 max-h-36 overflow-y-auto">
            {comments.map((c: any) => (
              <div key={c.id} className="bg-[#F8FAFC] rounded-lg p-2.5 border border-[#F1F5F9]">
                <p className="text-[11px] text-[#0F172A] leading-relaxed">{c.comment}</p>
                <p className="text-[10px] text-[#94A3B8] mt-1">
                  {c.user?.name ?? 'You'} · {new Date(c.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Book Demo button */}
      <button
        onClick={onBookDemo}
        className="w-full py-2 bg-[#059669] text-white text-xs font-semibold rounded-xl hover:bg-[#047857] transition-colors"
      >
        Book Demo
      </button>
    </div>
  )
}

function formatDate(d: string | null) {
  if (!d) return null
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function daysSince(d: string | null) {
  if (!d) return null
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
}

function RowSkeleton() {
  return (
    <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#F1F5F9] last:border-0">
      <div className="space-y-2">
        <div className="h-3.5 w-36 bg-[#F1F5F9] rounded skeleton" />
        <div className="h-3 w-20 bg-[#F1F5F9] rounded skeleton" />
      </div>
      <div className="flex items-center gap-3">
        <div className="h-5 w-16 bg-[#F1F5F9] rounded-full skeleton" />
        <div className="h-3 w-12 bg-[#F1F5F9] rounded skeleton" />
      </div>
    </div>
  )
}

export default function FollowupsPage() {
  const [leads, setLeads] = useState<FollowupLead[]>([])
  const [loading, setLoading] = useState(true)
  const [autoOpenLeadId, setAutoOpenLeadId] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => { fetchLeads() }, [])

  // Read ?open=leadId param to auto-expand that lead on navigation from search
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const openId = params.get('open')
    if (openId) setAutoOpenLeadId(openId)
  }, [])

  async function fetchLeads() {
    const { data: user } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('users').select('id').eq('auth_id', user.user!.id).single()
    if (!profile) return

    const { data } = await supabase
      .from('leads')
      .select('id, org_id, status, callback_date, follow_up_date, updated_at, organization:organizations(name, location, url, annual_revenue, team_size)')
      .eq('assigned_to', profile.id)
      .eq('is_deleted', false)
      .in('status', ['call_again', 'not_reachable'])
      .order('callback_date', { ascending: true, nullsFirst: false })

    setLeads((data ?? []) as unknown as FollowupLead[])
    setLoading(false)
  }

  const today = new Date().toISOString().split('T')[0]
  const overdue = leads.filter(l => l.callback_date && l.callback_date < today)
  const dueToday = leads.filter(l => l.callback_date === today)
  const upcoming = leads.filter(l => l.callback_date && l.callback_date > today)
  const unscheduled = leads.filter(l => !l.callback_date)

  if (loading) {
    return (
      <div className="flex-1 flex flex-col bg-[#F8FAFC]">
        <TopBar title="Follow-up Queue" subtitle="Loading..." />
        <div className="flex-1 p-6 space-y-5">
          {[...Array(2)].map((_, i) => (
            <div key={i}>
              <div className="h-4 w-20 bg-[#F1F5F9] rounded skeleton mb-2" />
              <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.06)' }}>
                <RowSkeleton />
                <RowSkeleton />
                <RowSkeleton />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (leads.length === 0) {
    return (
      <div className="flex-1 flex flex-col bg-[#F8FAFC]">
        <TopBar title="Follow-up Queue" subtitle="All clear" />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-sm text-center">
            <div className="w-12 h-12 rounded-2xl bg-[#F0FDF4] border border-[#BBF7D0] flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-6 h-6 text-[#059669]" strokeWidth={1.75} />
            </div>
            <h2 className="text-[15px] font-semibold text-[#0F172A] mb-2">Queue is clear</h2>
            <p className="text-[13px] text-[#64748B] leading-relaxed">
              No follow-ups pending — you're all caught up.
            </p>
          </div>
        </div>
      </div>
    )
  }

  function LeadRow({ lead }: { lead: FollowupLead }) {
    const [expanded, setExpanded] = useState(false)
    const [confirmDelete, setConfirmDelete] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [showBookDemo, setShowBookDemo] = useState(false)
    const [contacts, setContacts] = useState<any[]>([])
    const rowRef = useRef<HTMLDivElement>(null)
    const since = daysSince(lead.updated_at)
    const isOverdue = lead.callback_date ? lead.callback_date < today : false
    const isToday = lead.callback_date === today

    // Auto-expand and scroll when navigated from search with ?open=leadId
    useEffect(() => {
      if (autoOpenLeadId === lead.id) {
        setExpanded(true)
        setTimeout(() => {
          rowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 150)
      }
    }, [autoOpenLeadId])

    async function handleDelete(e: React.MouseEvent) {
      e.stopPropagation()
      setDeleting(true)
      const res = await fetch(`/api/leads/${lead.id}`, { method: 'DELETE' })
      if (res.ok) {
        setLeads(prev => prev.filter(l => l.id !== lead.id))
      }
      setDeleting(false)
      setConfirmDelete(false)
    }

    return (
      <div ref={rowRef} className="border-b border-[#F1F5F9] last:border-0">
        <div
          className="flex items-center justify-between px-5 py-3.5 hover:bg-[#F8FAFC] transition-colors cursor-pointer"
          onClick={() => setExpanded(prev => !prev)}
        >
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-[#0F172A] truncate">{lead.organization?.name}</p>
            <p className="text-[11px] text-[#94A3B8] mt-0.5">{lead.organization?.location}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0 ml-4">
            <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', LEAD_STATUS_COLORS[lead.status])}>
              {LEAD_STATUS_LABELS[lead.status]}
            </span>
            {lead.callback_date ? (
              <span className={cn(
                'text-[12px] font-semibold min-w-[60px] text-right',
                isOverdue ? 'text-[#EF4444]' : isToday ? 'text-[#1A56DB]' : 'text-[#64748B]'
              )}>
                {isOverdue && <span className="text-[10px] mr-1">Overdue</span>}
                {formatDate(lead.callback_date)}
              </span>
            ) : (
              <span className="text-[12px] text-[#94A3B8] min-w-[60px] text-right">
                {since !== null ? `${since}d ago` : '—'}
              </span>
            )}
            {/* Delete button / inline confirmation */}
            {confirmDelete ? (
              <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                <span className="text-[10px] text-[#EF4444] font-medium">Delete?</span>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-2 py-0.5 bg-[#EF4444] text-white rounded text-[10px] font-semibold disabled:opacity-60 hover:bg-[#DC2626]"
                >
                  {deleting ? '...' : 'Yes'}
                </button>
                <button
                  onClick={e => { e.stopPropagation(); setConfirmDelete(false) }}
                  className="px-2 py-0.5 border border-[#E2E8F0] text-[#64748B] rounded text-[10px] hover:bg-[#F8FAFC]"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={e => { e.stopPropagation(); setConfirmDelete(true) }}
                className="p-1 text-[#94A3B8] hover:text-[#EF4444] transition-colors"
                title="Delete lead"
              >
                <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            )}
            {expanded
              ? <ChevronUp className="w-3.5 h-3.5 text-[#94A3B8]" />
              : <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8]" />
            }
          </div>
        </div>
        {expanded && (
          <LeadExpandedDetail
            leadId={lead.id}
            onContactsLoaded={setContacts}
            onBookDemo={() => setShowBookDemo(true)}
            onRescheduled={fetchLeads}
            currentCallbackDate={lead.callback_date}
          />
        )}
        {showBookDemo && (
          <BookDemoModal
            lead={lead}
            contacts={contacts}
            onClose={() => setShowBookDemo(false)}
            onSuccess={() => {
              setShowBookDemo(false)
              setLeads(prev => prev.filter(l => l.id !== lead.id))
            }}
          />
        )}
      </div>
    )
  }

  function Section({ title, items, accentColor }: { title: string; items: FollowupLead[]; accentColor: string }) {
    if (items.length === 0) return null
    return (
      <div>
        <h2 className="text-label mb-2" style={{ color: accentColor }}>
          {title} &middot; {items.length}
        </h2>
        <div
          className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden"
          style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.06)' }}
        >
          {items.map(l => <LeadRow key={l.id} lead={l} />)}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-[#F8FAFC]">
      <TopBar
        title="Follow-up Queue"
        subtitle={`${leads.length} pending · ${overdue.length} overdue · ${dueToday.length} today`}
      />
      <div className="flex-1 p-6 space-y-5 overflow-y-auto animate-in-page">
        <Section title="Overdue" items={overdue} accentColor="#EF4444" />
        <Section title="Today" items={dueToday} accentColor="#1A56DB" />
        <Section title="Upcoming" items={upcoming} accentColor="#64748B" />
        <Section title="No Date Set" items={unscheduled} accentColor="#94A3B8" />
      </div>
    </div>
  )
}

// ── Book Demo Modal (ported from My Leads page) ───────────────────────────────
function BookDemoModal({ lead, contacts, onClose, onSuccess }: {
  lead: FollowupLead
  contacts: any[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [demoDate, setDemoDate] = useState('')
  const [painPoint, setPainPoint] = useState('')
  const [demoExpectation, setDemoExpectation] = useState('')
  const [extraNotes, setExtraNotes] = useState('')
  const [signal, setSignal] = useState('warm')
  const [closerId, setCloserId] = useState('')
  const [closers, setClosers] = useState<{ id: string; name: string }[]>([])
  const [saving, setSaving] = useState(false)
  const primaryContact = contacts.find(c => c.is_primary) ?? contacts[0]

  const canSubmit = painPoint.trim().length >= 5 && demoExpectation.trim().length >= 5 && !!closerId && !!demoDate

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
        lead_id: lead.id,
        org_id: lead.org_id,
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

        {/* Org context */}
        <div className="bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] p-3.5 mb-4 space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8]">Organisation</p>
          <p className="font-semibold text-[#0F172A] text-sm">{lead.organization?.name}</p>
          <div className="flex flex-wrap gap-3 text-xs text-[#64748B]">
            {lead.organization?.location && <span>{lead.organization.location}</span>}
            {lead.organization?.url && (
              <a href={lead.organization.url} target="_blank" rel="noreferrer" className="text-[#1A56DB] hover:underline">
                {lead.organization.url}
              </a>
            )}
            {lead.organization?.annual_revenue && <span>₹{(lead.organization.annual_revenue / 100000).toFixed(0)}L revenue</span>}
            {lead.organization?.team_size && <span>{lead.organization.team_size} people</span>}
          </div>
          {primaryContact && (
            <div className="flex gap-3 text-xs text-[#64748B] pt-1 border-t border-[#E2E8F0] mt-1">
              <span className="font-medium text-[#0F172A]">KDM: {primaryContact.name}</span>
              {primaryContact.designation && <span>{primaryContact.designation}</span>}
              {primaryContact.phone && <span>{primaryContact.phone}</span>}
            </div>
          )}
        </div>

        <form onSubmit={submit} className="space-y-3.5">
          {/* Demo date */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#64748B] mb-1">
              Demo Date &amp; Time <span className="text-red-500">*</span>
            </label>
            <DateTimePicker value={demoDate} onChange={setDemoDate} placeholder="Pick demo date & time" />
          </div>

          {/* Closer */}
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
                {closers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </div>

          {/* Interest signal */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#64748B] mb-1">Interest Signal</label>
            <div className="flex gap-2">
              {[{ value: 'hot', label: 'Hot', color: '#EF4444' }, { value: 'warm', label: 'Warm', color: '#F59E0B' }, { value: 'cold', label: 'Cold', color: '#64748B' }].map(s => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setSignal(s.value)}
                  className={cn(
                    'flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-colors',
                    signal === s.value ? 'text-white border-transparent' : 'border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1]'
                  )}
                  style={signal === s.value ? { backgroundColor: s.color, borderColor: s.color } : {}}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Context for Closer */}
          <div className="space-y-3 p-3.5 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">
              Context for Closer <span className="text-red-500">*</span>
            </p>
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1">What is their main pain point?</label>
              <textarea
                value={painPoint}
                onChange={e => setPainPoint(e.target.value)}
                required
                rows={2}
                placeholder="e.g. They struggle with donor retention..."
                className={cn(
                  'w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 resize-none',
                  painPoint.length > 0 && painPoint.trim().length < 5 ? 'border-red-300 focus:ring-red-200/20' : 'border-[#E2E8F0] focus:ring-[#1A56DB]/20'
                )}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1">What are they expecting from the demo?</label>
              <textarea
                value={demoExpectation}
                onChange={e => setDemoExpectation(e.target.value)}
                required
                rows={2}
                placeholder="e.g. They want to see the reporting dashboard..."
                className={cn(
                  'w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 resize-none',
                  demoExpectation.length > 0 && demoExpectation.trim().length < 5 ? 'border-red-300 focus:ring-red-200/20' : 'border-[#E2E8F0] focus:ring-[#1A56DB]/20'
                )}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1">
                Anything else the closer should know? <span className="font-normal text-[#94A3B8]">(optional)</span>
              </label>
              <textarea
                value={extraNotes}
                onChange={e => setExtraNotes(e.target.value)}
                rows={2}
                placeholder="Budget signals, decision timeline, objections..."
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
