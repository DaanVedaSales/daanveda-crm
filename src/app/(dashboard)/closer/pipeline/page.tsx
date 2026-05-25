'use client'

import { useState, useEffect } from 'react'
import TopBar from '@/components/layout/TopBar'
import { createClient } from '@/lib/supabase/client'
import { KANBAN_STAGES, DEAL_STAGE_LABELS, DEAL_STAGE_COLORS } from '@/lib/constants'
import { formatCurrency } from '@/lib/utils'
import type { DealStage } from '@/types/database'
import { X, Send, Trash2, IndianRupee, Calendar, GripVertical, Plus, ChevronDown, ExternalLink, Building2, Users, Banknote, Tag, AlertCircle, Target, StickyNote, MessageSquare, User, Search } from 'lucide-react'
import DateTimePicker from '@/components/ui/DateTimePicker'
import OrgSearchInput from '@/components/crm/OrgSearchInput'
import OrgSearchModal from '@/components/crm/OrgSearchModal'
import type { OrgSearchResult } from '@/app/api/organizations/search/route'
import { cn } from '@/lib/utils'

interface DealWithDetails {
  id: string
  stage: DealStage
  deal_value: number | null
  next_follow_up: string | null
  loss_reason: string | null
  billing_name: string | null
  proposal_sent_at: string | null
  removed_from_board: boolean | null
  updated_at: string
  created_at: string
  sdr_id: string | null
  poc_name: string | null
  poc_designation: string | null
  poc_phone: string | null
  poc_email: string | null
  organization: {
    id: string
    name: string
    location: string | null
    annual_revenue: number | null
    team_size: number | null
    thematic_areas: string[] | null
    linkedin_url: string | null
    url: string | null
  }
  demo?: {
    id: string
    demo_date: string
    pain_point: string | null
    demo_expectation: string | null
    sdr_summary: string | null
    sdr_interest_signal: string | null
    sdr: { id: string; name: string } | null
  }
}

interface Column { stage: DealStage; deals: DealWithDetails[] }

// Stages that are terminal — collapsible by default
const TERMINAL_STAGES: DealStage[] = ['won', 'lost', 'ghosted', 'unqualified']

// ── Skeleton card ──────────────────────────────────────────────────────────────
function CardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] p-3.5 space-y-2.5">
      <div className="skeleton h-3 w-3/4 rounded" />
      <div className="skeleton h-4 w-1/2 rounded" />
      <div className="skeleton h-2.5 w-full rounded" />
    </div>
  )
}

// ── Draggable Card ─────────────────────────────────────────────────────────────
function DealCard({
  deal,
  onDragStart,
  onClick,
  onProposalSent,
}: {
  deal: DealWithDetails
  onDragStart: (dealId: string) => void
  onClick: (deal: DealWithDetails) => void
  onProposalSent: () => void
}) {
  const [markingProposal, setMarkingProposal] = useState(false)
  const [markingUnqualified, setMarkingUnqualified] = useState(false)
  const daysInStage = Math.floor((Date.now() - new Date(deal.updated_at).getTime()) / 86400000)
  const isStale     = daysInStage > 7 && !TERMINAL_STAGES.includes(deal.stage)
  const stageColor  = DEAL_STAGE_COLORS[deal.stage]

  async function handleProposalClick(e: React.MouseEvent) {
    e.stopPropagation()
    setMarkingProposal(true)
    await fetch(`/api/deals/${deal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposal_sent_at: new Date().toISOString(), stage: 'follow_up' }),
    })
    setMarkingProposal(false)
    onProposalSent()
  }

  async function handleUnqualifiedClick(e: React.MouseEvent) {
    e.stopPropagation()
    setMarkingUnqualified(true)
    await fetch(`/api/deals/${deal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: 'unqualified' }),
    })
    setMarkingUnqualified(false)
    onProposalSent() // reuse refresh callback
  }

  const followUpLabel = deal.next_follow_up
    ? `FU ${new Date(deal.next_follow_up).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
    : `${daysInStage}d`

  return (
    <div
      draggable
      onDragStart={() => onDragStart(deal.id)}
      onClick={() => onClick(deal)}
      className={cn(
        'relative bg-white rounded-xl border cursor-grab active:cursor-grabbing',
        'hover:shadow-raised transition-all duration-150 group select-none overflow-hidden',
        isStale ? 'border-[#FCD34D]' : 'border-[#E2E8F0]',
      )}
      style={{ boxShadow: '0 1px 3px rgba(15,23,42,0.05)' }}
    >
      {/* Stage color left border */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ backgroundColor: stageColor }}
      />

      <div className="pl-3.5 pr-3 py-3">
        {/* Drag handle + stale badge */}
        <div className="flex items-start justify-between gap-1 mb-1.5">
          <p className="font-medium text-[13px] text-[#0F172A] leading-snug line-clamp-2 flex-1">
            {deal.organization?.name}
          </p>
          <div className="flex items-center gap-1 shrink-0">
            {isStale && (
              <span className="text-[9px] font-semibold text-[#92400E] bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                STALE
              </span>
            )}
            <GripVertical
              className="w-3.5 h-3.5 text-[#CBD5E1] opacity-0 group-hover:opacity-100 transition-opacity"
              strokeWidth={1.5}
            />
          </div>
        </div>

        {/* Deal value */}
        <p
          className={cn(
            'text-[15px] font-bold leading-none mb-2',
            deal.deal_value ? 'text-[#0F172A]' : 'text-[#94A3B8]',
          )}
          style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}
        >
          {deal.deal_value ? formatCurrency(deal.deal_value) : 'Set value'}
        </p>

        {/* Meta row */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-[#94A3B8] truncate">
            {deal.organization?.location ?? '—'}
          </span>
          <span className="text-[10px] text-[#94A3B8] shrink-0 ml-1 tabular">
            {followUpLabel}
          </span>
        </div>

        {/* Proposal sent badge */}
        {deal.proposal_sent_at && (
          <div className="mt-2 flex items-center gap-1">
            <span className="text-[10px] text-[#0891B2] border border-[#BAE6FD] px-2 py-0.5 rounded-full bg-cyan-50 font-medium">
              Proposal sent
            </span>
          </div>
        )}

        {/* Quick-action buttons — demo_done only */}
        {deal.stage === 'demo_done' && (
          <div className="mt-2 flex gap-1.5">
            {!deal.proposal_sent_at && (
              <button
                onClick={handleProposalClick}
                disabled={markingProposal || markingUnqualified}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-[#F0F9FF] border border-[#BAE6FD] text-[#0284C7] text-[10px] font-semibold rounded-lg hover:bg-[#E0F2FE] disabled:opacity-50 transition-colors"
              >
                <Send className="w-2.5 h-2.5" strokeWidth={2} />
                {markingProposal ? 'Saving…' : 'Proposal Sent'}
              </button>
            )}
            <button
              onClick={handleUnqualifiedClick}
              disabled={markingProposal || markingUnqualified}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-semibold rounded-lg hover:bg-amber-100 disabled:opacity-50 transition-colors"
            >
              {markingUnqualified ? 'Saving…' : 'Unqualified'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Kanban Column ──────────────────────────────────────────────────────────────
function KanbanColumn({
  stage, deals, draggingId, onDrop, onDragStart, onCardClick, onProposalSent,
  collapsed, onToggleCollapse,
}: {
  stage: DealStage
  deals: DealWithDetails[]
  draggingId: string | null
  onDrop: (stage: DealStage) => void
  onDragStart: (id: string) => void
  onCardClick: (deal: DealWithDetails) => void
  onProposalSent: () => void
  collapsed: boolean
  onToggleCollapse: () => void
}) {
  const [isOver, setIsOver] = useState(false)
  const color    = DEAL_STAGE_COLORS[stage]
  const colValue = deals.reduce((s, d) => s + (d.deal_value ?? 0), 0)
  const isTerminal = TERMINAL_STAGES.includes(stage)

  if (collapsed) {
    return (
      <div className="flex-shrink-0 w-12 flex flex-col items-center">
        <button
          onClick={onToggleCollapse}
          className="flex flex-col items-center gap-2 w-full py-3 rounded-xl hover:bg-white/80 transition-colors group"
          title={`${DEAL_STAGE_LABELS[stage]} (${deals.length})`}
        >
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
          <div
            className="writing-mode-vertical text-[10px] font-semibold text-[#94A3B8] group-hover:text-[#64748B] transition-colors"
            style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', letterSpacing: '0.05em' }}
          >
            {DEAL_STAGE_LABELS[stage]}
          </div>
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: color + '18', color }}
          >
            {deals.length}
          </span>
        </button>
      </div>
    )
  }

  return (
    <div className="flex-shrink-0 w-56 flex flex-col">
      {/* Column header */}
      <div className="flex items-center justify-between mb-2.5 px-0.5">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-[12px] font-semibold text-[#0F172A] tracking-tight">
            {DEAL_STAGE_LABELS[stage]}
          </span>
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: color + '18', color }}
          >
            {deals.length}
          </span>
        </div>
        {isTerminal && (
          <button
            onClick={onToggleCollapse}
            className="p-0.5 text-[#94A3B8] hover:text-[#64748B] transition-colors"
            title="Collapse column"
          >
            <ChevronDown className="w-3.5 h-3.5" strokeWidth={1.75} />
          </button>
        )}
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setIsOver(true) }}
        onDragLeave={() => setIsOver(false)}
        onDrop={() => { setIsOver(false); onDrop(stage) }}
        className="flex-1 min-h-[80px] rounded-xl p-2 space-y-2 transition-all duration-150 scrollbar-none"
        style={{
          backgroundColor: isOver ? `${color}12` : `${color}06`,
          outline: isOver ? `2px solid ${color}50` : 'none',
          outlineOffset: '2px',
        }}
      >
        {deals.map(deal => (
          <DealCard
            key={deal.id}
            deal={deal}
            onDragStart={onDragStart}
            onClick={onCardClick}
            onProposalSent={onProposalSent}
          />
        ))}
        {deals.length === 0 && (
          <div
            className="flex items-center justify-center h-14 rounded-lg border-2 border-dashed transition-colors"
            style={{ borderColor: isOver ? color : '#E2E8F0' }}
          >
            <p className="text-[11px] text-[#CBD5E1]">Drop here</p>
          </div>
        )}
      </div>

      {/* Column total */}
      {deals.length > 0 && colValue > 0 && (
        <p
          className="text-center text-[10px] text-[#94A3B8] mt-1.5 tabular"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {formatCurrency(colValue)}
        </p>
      )}
    </div>
  )
}

// Stages where POC section is shown
const POC_VISIBLE_STAGES: DealStage[] = ['demo_done', 'follow_up', 'proposal', 'negotiation', 'won', 'lost', 'ghosted', 'unqualified']

interface DealComment {
  id: string
  comment: string
  deal_stage: string
  created_at: string
  user: { id: string; name: string } | null
}

// ── Deal Detail Panel ──────────────────────────────────────────────────────────
function DealPanel({ deal, contacts, onClose, onUpdate, onDelete }: {
  deal: DealWithDetails
  contacts: any[]
  onClose: () => void
  onUpdate: () => void
  onDelete: (dealId: string) => void
}) {
  const [dealValue,   setDealValue]   = useState(deal.deal_value?.toString() ?? '')
  const [followUpDate, setFollowUpDate] = useState(deal.next_follow_up ?? '')
  const [lossReason,  setLossReason]  = useState(deal.loss_reason ?? '')
  const [billingName, setBillingName] = useState(deal.billing_name ?? '')
  const [saving,      setSaving]      = useState(false)
  const [removing,    setRemoving]    = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting,    setDeleting]    = useState(false)
  const [kdmExpanded, setKdmExpanded] = useState(false)

  // POC state
  const [pocName,        setPocName]        = useState(deal.poc_name ?? '')
  const [pocDesignation, setPocDesignation] = useState(deal.poc_designation ?? '')
  const [pocPhone,       setPocPhone]       = useState(deal.poc_phone ?? '')
  const [pocEmail,       setPocEmail]       = useState(deal.poc_email ?? '')
  const [pocEditing,     setPocEditing]     = useState(false)
  const [pocSaving,      setPocSaving]      = useState(false)

  // Comments state
  const [comments,       setComments]       = useState<DealComment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(true)
  const [commentText,    setCommentText]    = useState('')
  const [postingComment, setPostingComment] = useState(false)

  const showPoc = POC_VISIBLE_STAGES.includes(deal.stage)

  useEffect(() => {
    fetch(`/api/deals/comments?deal_id=${deal.id}`)
      .then(r => r.json())
      .then(data => { setComments(Array.isArray(data) ? data : []); setCommentsLoading(false) })
      .catch(() => setCommentsLoading(false))
  }, [deal.id])

  async function save() {
    setSaving(true)
    const payload: Record<string, unknown> = {}
    if (dealValue)    payload.deal_value   = parseInt(dealValue)
    if (followUpDate) payload.next_follow_up = followUpDate
    if (lossReason)   payload.loss_reason  = lossReason
    if (billingName)  payload.billing_name = billingName
    await fetch(`/api/deals/${deal.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    setSaving(false); onUpdate(); onClose()
  }

  async function savePoc() {
    setPocSaving(true)
    await fetch(`/api/deals/${deal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        poc_name: pocName.trim() || null,
        poc_designation: pocDesignation.trim() || null,
        poc_phone: pocPhone.trim() || null,
        poc_email: pocEmail.trim() || null,
      }),
    })
    setPocSaving(false)
    setPocEditing(false)
    onUpdate()
  }

  async function postComment() {
    if (!commentText.trim()) return
    setPostingComment(true)
    const res = await fetch('/api/deals/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deal_id: deal.id, comment: commentText.trim(), deal_stage: deal.stage }),
    })
    if (res.ok) {
      const newComment: DealComment = await res.json()
      setComments(prev => [newComment, ...prev])
      setCommentText('')
    }
    setPostingComment(false)
  }

  async function removeFromBoard() {
    setRemoving(true)
    await fetch(`/api/deals/${deal.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ removed_from_board: true }) })
    setRemoving(false); onUpdate(); onClose()
  }

  async function handleDelete() {
    setDeleting(true)
    // If demo_id exists, DELETE /api/demos/:id (cascades lead return to SDR)
    // Otherwise just soft-delete deal directly (shouldn't happen but be safe)
    if (deal.demo?.id) {
      await fetch(`/api/demos/${deal.demo.id}`, { method: 'DELETE' })
    }
    setDeleting(false)
    onDelete(deal.id)
  }

  const stageColor = DEAL_STAGE_COLORS[deal.stage]
  const demoDateStr = deal.demo?.demo_date
    ? new Date(deal.demo.demo_date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })
    : null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-[#0F172A]/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-[380px] bg-white h-full shadow-panel flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#F1F5F9] flex items-start justify-between">
          <div className="flex-1 min-w-0 pr-3">
            <p className="font-semibold text-[15px] text-[#0F172A] tracking-tight truncate">{deal.organization?.name}</p>
            {deal.organization?.location && (
              <p className="text-[11px] text-[#94A3B8] mt-0.5">{deal.organization.location}</p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <span
                className="text-[10px] font-semibold px-2.5 py-1 rounded-full text-white"
                style={{ backgroundColor: stageColor }}
              >
                {DEAL_STAGE_LABELS[deal.stage]}
              </span>
              {deal.proposal_sent_at && (
                <span className="text-[10px] text-[#0891B2] border border-[#BAE6FD] px-2 py-0.5 rounded-full bg-cyan-50 font-medium">
                  Proposal sent
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {confirmDelete ? (
              <div className="flex items-center gap-1.5 mr-1">
                <span className="text-[11px] text-[#EF4444] font-medium whitespace-nowrap">Remove from pipeline?</span>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-2 py-0.5 bg-[#EF4444] text-white text-[10px] font-semibold rounded-lg disabled:opacity-60 hover:bg-[#DC2626]"
                >
                  {deleting ? '...' : 'Yes'}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-2 py-0.5 border border-[#E2E8F0] text-[#64748B] text-[10px] rounded-lg hover:bg-[#F8FAFC]"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="p-2 rounded-lg hover:bg-red-50 text-[#94A3B8] hover:text-[#EF4444] transition-colors"
                title="Delete deal"
              >
                <Trash2 className="w-4 h-4" strokeWidth={1.75} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-[#F1F5F9] text-[#94A3B8] hover:text-[#374151] transition-colors"
            >
              <X className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin p-5 space-y-4">

          {/* ── Org Overview ─────────────────────────────────────────────── */}
          <div className="p-4 bg-[#F8FAFC] rounded-xl border border-[#F1F5F9] space-y-3">
            <p className="text-label text-[#94A3B8] flex items-center gap-1.5">
              <Building2 className="w-3 h-3" strokeWidth={2} /> Organisation Overview
            </p>

            {/* Thematic areas */}
            {deal.organization?.thematic_areas && deal.organization.thematic_areas.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {deal.organization.thematic_areas.map((t, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 bg-[#EFF6FF] text-[#1A56DB] border border-[#BFDBFE] rounded-full">
                    <Tag className="w-2.5 h-2.5" strokeWidth={2} />{t}
                  </span>
                ))}
              </div>
            )}

            {/* Stats row */}
            <div className="flex flex-wrap gap-4">
              {deal.organization?.team_size && (
                <div className="flex items-center gap-1.5 text-[12px] text-[#374151]">
                  <Users className="w-3 h-3 text-[#94A3B8]" strokeWidth={2} />
                  <span>{deal.organization.team_size} people</span>
                </div>
              )}
              {deal.organization?.annual_revenue && (
                <div className="flex items-center gap-1.5 text-[12px] text-[#374151]">
                  <Banknote className="w-3 h-3 text-[#94A3B8]" strokeWidth={2} />
                  <span>₹{(deal.organization.annual_revenue / 100000).toFixed(0)}L revenue</span>
                </div>
              )}
            </div>

            {/* Research links */}
            {(deal.organization?.linkedin_url || deal.organization?.url) && (
              <div className="flex flex-wrap gap-2 pt-1">
                {deal.organization.linkedin_url && (
                  <a
                    href={deal.organization.linkedin_url}
                    target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 bg-[#EFF6FF] text-[#1A56DB] border border-[#BFDBFE] rounded-lg hover:bg-[#DBEAFE] transition-colors"
                  >
                    <ExternalLink className="w-2.5 h-2.5" strokeWidth={2.5} /> LinkedIn
                  </a>
                )}
                {deal.organization.url && (
                  <a
                    href={deal.organization.url}
                    target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 bg-[#F8FAFC] text-[#374151] border border-[#E2E8F0] rounded-lg hover:bg-[#F1F5F9] transition-colors"
                  >
                    <ExternalLink className="w-2.5 h-2.5" strokeWidth={2.5} /> Website
                  </a>
                )}
              </div>
            )}
          </div>

          {/* ── Key Decision Makers ──────────────────────────────────────── */}
          {contacts.length > 0 && (
            <div className="rounded-xl border border-[#E2E8F0] overflow-hidden">
              <button
                onClick={() => setKdmExpanded(p => !p)}
                className="w-full flex items-center justify-between px-4 py-3 bg-[#F8FAFC] hover:bg-[#F1F5F9] transition-colors text-left"
              >
                <p className="text-label text-[#94A3B8]">
                  Key Decision Makers · {contacts.length}
                </p>
                {kdmExpanded
                  ? <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8] rotate-180 transition-transform" strokeWidth={1.75} />
                  : <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8] transition-transform" strokeWidth={1.75} />
                }
              </button>
              {kdmExpanded && (
                <div className="p-3 space-y-2 bg-white">
                  {contacts.map((c: any) => (
                    <div key={c.id} className="bg-[#F8FAFC] rounded-lg p-3 border border-[#F1F5F9]">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-[13px] font-medium text-[#0F172A]">{c.name}</p>
                        {c.is_primary && (
                          <span className="text-[9px] font-semibold bg-[#1A56DB] text-white px-1.5 py-0.5 rounded-full">Primary</span>
                        )}
                      </div>
                      {c.designation && <p className="text-[11px] text-[#64748B]">{c.designation}</p>}
                      <div className="flex gap-3 mt-1 text-[11px] text-[#94A3B8]">
                        {c.phone && <span>{c.phone}</span>}
                        {c.email && <span>{c.email}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Deal Timeline ─────────────────────────────────────────────── */}
          {(() => {
            const milestones = [
              {
                label: 'Pipeline Entry',
                date: deal.created_at,
                done: true,
                color: '#1A56DB',
              },
              {
                label: 'Demo',
                date: deal.demo?.demo_date ?? null,
                done: !!deal.demo?.demo_date,
                color: '#7C3AED',
              },
              {
                label: 'Proposal Sent',
                date: deal.proposal_sent_at,
                done: !!deal.proposal_sent_at,
                color: '#0891B2',
              },
              {
                label: 'Next Follow-up',
                date: deal.next_follow_up,
                done: !!deal.next_follow_up,
                color: '#059669',
              },
            ]
            return (
              <div className="px-1">
                <p className="text-label text-[#94A3B8] mb-3 flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" strokeWidth={2} /> Deal Timeline
                </p>
                <div className="space-y-2">
                  {milestones.map((m, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <div className="flex flex-col items-center shrink-0 mt-0.5">
                        <div
                          className={cn('w-2.5 h-2.5 rounded-full border-2', m.done ? '' : 'bg-transparent')}
                          style={m.done ? { backgroundColor: m.color, borderColor: m.color } : { borderColor: '#CBD5E1' }}
                        />
                        {idx < milestones.length - 1 && (
                          <div className={cn('w-px flex-1 mt-1', m.done ? 'bg-[#CBD5E1]' : 'bg-[#E2E8F0]')} style={{ height: '16px' }} />
                        )}
                      </div>
                      <div className="pb-1">
                        <p className={cn('text-[11px] font-medium', m.done ? 'text-[#0F172A]' : 'text-[#CBD5E1]')}>
                          {m.label}
                        </p>
                        {m.date ? (
                          <p className="text-[10px] text-[#94A3B8] mt-0.5">
                            {new Date(m.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {m.label === 'Demo' && (
                              <span className="ml-1">
                                · {new Date(m.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                              </span>
                            )}
                          </p>
                        ) : (
                          <p className="text-[10px] text-[#CBD5E1] mt-0.5">Not yet</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          {/* ── SDR Context ───────────────────────────────────────────────── */}
          {deal.demo && (deal.demo.pain_point || deal.demo.demo_expectation || deal.demo.sdr_summary) && (
            <div className="p-4 bg-[#FFFBEB] rounded-xl border border-[#FDE68A] space-y-3">
              <p className="text-label text-[#92400E] flex items-center gap-1.5">
                <StickyNote className="w-3 h-3" strokeWidth={2} />
                SDR Intel{deal.demo.sdr?.name ? ` · ${deal.demo.sdr.name}` : ''}
                {deal.demo.sdr_interest_signal && (
                  <span className={cn(
                    'ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full',
                    deal.demo.sdr_interest_signal === 'hot' ? 'bg-red-100 text-red-700' :
                    deal.demo.sdr_interest_signal === 'warm' ? 'bg-amber-100 text-amber-700' :
                    'bg-slate-100 text-slate-600'
                  )}>
                    {deal.demo.sdr_interest_signal.toUpperCase()}
                  </span>
                )}
              </p>

              {deal.demo.pain_point && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <AlertCircle className="w-3 h-3 text-[#D97706]" strokeWidth={2} />
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[#D97706]">Main Pain Point</p>
                  </div>
                  <p className="text-[12px] text-[#374151] leading-relaxed pl-4">{deal.demo.pain_point}</p>
                </div>
              )}

              {deal.demo.demo_expectation && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Target className="w-3 h-3 text-[#D97706]" strokeWidth={2} />
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[#D97706]">Expecting from Demo</p>
                  </div>
                  <p className="text-[12px] text-[#374151] leading-relaxed pl-4">{deal.demo.demo_expectation}</p>
                </div>
              )}

              {deal.demo.sdr_summary && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8] mb-1">Additional Notes</p>
                  <p className="text-[12px] text-[#64748B] leading-relaxed">{deal.demo.sdr_summary}</p>
                </div>
              )}
            </div>
          )}

          {/* ── Point of Contact ─────────────────────────────────────────── */}
          {showPoc && (
            <div className="p-4 bg-white rounded-xl border border-[#E2E8F0] space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-label text-[#94A3B8] flex items-center gap-1.5">
                  <User className="w-3 h-3" strokeWidth={2} /> Point of Contact
                </p>
                {!pocEditing && (
                  <button
                    onClick={() => setPocEditing(true)}
                    className="text-[11px] font-medium text-[#1A56DB] hover:text-[#1743B0] transition-colors"
                  >
                    {pocName ? 'Edit' : '+ Add'}
                  </button>
                )}
              </div>

              {pocEditing ? (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-[#94A3B8] mb-1">Name</label>
                      <input
                        value={pocName}
                        onChange={e => setPocName(e.target.value)}
                        placeholder="Full name"
                        className="field text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[#94A3B8] mb-1">Designation</label>
                      <input
                        value={pocDesignation}
                        onChange={e => setPocDesignation(e.target.value)}
                        placeholder="CFO, Director..."
                        className="field text-sm"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-[#94A3B8] mb-1">Phone</label>
                      <input
                        value={pocPhone}
                        onChange={e => setPocPhone(e.target.value)}
                        placeholder="+91 98765 43210"
                        className="field text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[#94A3B8] mb-1">Email</label>
                      <input
                        value={pocEmail}
                        onChange={e => setPocEmail(e.target.value)}
                        placeholder="poc@org.com"
                        className="field text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={savePoc}
                      disabled={pocSaving}
                      className="flex-1 py-1.5 text-xs font-medium bg-[#1A56DB] text-white rounded-lg hover:bg-[#1743B0] disabled:opacity-60 transition-colors"
                    >
                      {pocSaving ? 'Saving…' : 'Save POC'}
                    </button>
                    <button
                      onClick={() => { setPocEditing(false); setPocName(deal.poc_name ?? ''); setPocDesignation(deal.poc_designation ?? ''); setPocPhone(deal.poc_phone ?? ''); setPocEmail(deal.poc_email ?? '') }}
                      className="py-1.5 px-3 text-xs border border-[#E2E8F0] text-[#64748B] rounded-lg hover:bg-[#F8FAFC]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : pocName ? (
                <div className="space-y-1.5">
                  <p className="text-[13px] font-semibold text-[#0F172A]">{pocName}</p>
                  {pocDesignation && <p className="text-[11px] text-[#64748B]">{pocDesignation}</p>}
                  <div className="flex flex-wrap gap-3 text-[11px] text-[#94A3B8] mt-1">
                    {pocPhone && <span>{pocPhone}</span>}
                    {pocEmail && <span>{pocEmail}</span>}
                  </div>
                </div>
              ) : (
                <p className="text-[12px] text-[#94A3B8]">No POC added yet — click + Add to record who to follow up with.</p>
              )}
            </div>
          )}

          {/* ── Comments ─────────────────────────────────────────────────── */}
          <div className="space-y-3">
            <p className="text-label text-[#94A3B8] flex items-center gap-1.5">
              <MessageSquare className="w-3 h-3" strokeWidth={2} /> Comments
              {comments.length > 0 && <span className="ml-auto text-[10px] text-[#CBD5E1]">{comments.length}</span>}
            </p>

            {/* Comment input */}
            <div className="flex flex-col gap-2">
              <textarea
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) postComment() }}
                rows={2}
                placeholder="Add a note about this deal… (⌘+Enter to post)"
                className="field resize-none text-sm"
                maxLength={1000}
              />
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#CBD5E1]">{commentText.length}/1000</span>
                <button
                  onClick={postComment}
                  disabled={postingComment || !commentText.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#1A56DB] text-white rounded-lg hover:bg-[#1743B0] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-3 h-3" strokeWidth={2} />
                  {postingComment ? 'Posting…' : 'Post'}
                </button>
              </div>
            </div>

            {/* Comment feed */}
            {commentsLoading ? (
              <div className="space-y-2">
                {[...Array(2)].map((_, i) => (
                  <div key={i} className="p-3 bg-[#F8FAFC] rounded-xl border border-[#F1F5F9] space-y-1.5">
                    <div className="skeleton h-2.5 w-24 rounded" />
                    <div className="skeleton h-3 w-full rounded" />
                  </div>
                ))}
              </div>
            ) : comments.length === 0 ? (
              <p className="text-[12px] text-[#CBD5E1] text-center py-3">No comments yet</p>
            ) : (
              <div className="space-y-2">
                {comments.map(c => (
                  <div key={c.id} className="p-3 bg-[#F8FAFC] rounded-xl border border-[#F1F5F9]">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-[#EFF6FF] flex items-center justify-center">
                          <span className="text-[9px] font-bold text-[#1A56DB]">
                            {c.user?.name?.charAt(0).toUpperCase() ?? '?'}
                          </span>
                        </div>
                        <span className="text-[11px] font-medium text-[#374151]">{c.user?.name ?? 'Unknown'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full text-white"
                          style={{ backgroundColor: DEAL_STAGE_COLORS[c.deal_stage as DealStage] ?? '#94A3B8' }}
                        >
                          {DEAL_STAGE_LABELS[c.deal_stage as DealStage] ?? c.deal_stage}
                        </span>
                        <span className="text-[10px] text-[#94A3B8]">
                          {new Date(c.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                    </div>
                    <p className="text-[12px] text-[#374151] leading-relaxed whitespace-pre-wrap">{c.comment}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Deal Value */}
          <div>
            <label className="text-label text-[#64748B] mb-1.5 block">Deal Value (₹)</label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8]" strokeWidth={1.75} />
              <input
                type="number"
                value={dealValue}
                onChange={e => setDealValue(e.target.value)}
                placeholder="e.g. 50000"
                className="field pl-8"
              />
            </div>
          </div>

          {/* Next Follow-up */}
          <div>
            <label className="text-label text-[#64748B] mb-1.5 block">Next Follow-up</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8]" strokeWidth={1.75} />
              <input
                type="date"
                value={followUpDate}
                onChange={e => setFollowUpDate(e.target.value)}
                className="field pl-8"
              />
            </div>
          </div>

          {deal.stage === 'lost' && (
            <div>
              <label className="text-label text-[#EF4444] mb-1.5 block">Loss Reason</label>
              <textarea
                value={lossReason}
                onChange={e => setLossReason(e.target.value)}
                placeholder="Why was this deal lost?"
                rows={3}
                className="field resize-none"
              />
            </div>
          )}

          {deal.stage === 'won' && (
            <div>
              <label className="text-label text-[#059669] mb-1.5 block">Billing Name</label>
              <input
                type="text"
                value={billingName}
                onChange={e => setBillingName(e.target.value)}
                placeholder="Organisation billing name"
                className="field"
              />
            </div>
          )}

          {deal.stage === 'unqualified' && (
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
              <p className="text-[12px] text-[#92400E] leading-relaxed">
                Marked as <span className="font-semibold">Unqualified</span> — the org attended the demo but wasn't a fit. This will be reflected in the SDR's lead quality metrics.
              </p>
            </div>
          )}

          {deal.stage === 'ghosted' && (
            <div className="p-4 bg-[#FEF2F2] rounded-xl border border-[#FECACA]">
              <p className="text-[12px] text-[#374151] mb-3 leading-relaxed">
                This org has gone dark. Removing it from the board keeps your pipeline clean — the record stays in your database.
              </p>
              <button
                onClick={removeFromBoard}
                disabled={removing}
                className="btn-danger text-xs py-2"
              >
                <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                {removing ? 'Removing…' : 'Remove from Board'}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[#F1F5F9]">
          <button onClick={save} disabled={saving} className="btn-primary w-full py-2.5 text-sm">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Add Deal Modal ─────────────────────────────────────────────────────────────
function AddDealModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [orgName,       setOrgName]       = useState('')
  const [selectedOrg,   setSelectedOrg]   = useState<OrgSearchResult | null>(null)
  const [location,      setLocation]      = useState('')
  const [kdmName,       setKdmName]       = useState('')
  const [kdmPhone,      setKdmPhone]      = useState('')
  const [kdmDesignation, setKdmDesig]     = useState('')
  const [dealValue,     setDealValue]     = useState('')
  const [demoStatus,    setDemoStatus]    = useState<'tbd' | 'scheduled' | 'done'>('tbd')
  const [demoDate,      setDemoDate]      = useState('')
  const [sdrSummary,    setSdrSummary]    = useState('')
  const [saving,        setSaving]        = useState(false)
  const [error,         setError]         = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError('')
    if (demoStatus === 'scheduled' && !demoDate) { setError('Please select a demo date and time.'); return }
    setSaving(true)
    const res = await fetch('/api/deals/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_name: orgName, location, kdm_name: kdmName, kdm_phone: kdmPhone, kdm_designation: kdmDesignation, deal_value: dealValue || null, demo_status: demoStatus, demo_date: demoDate || null, sdr_summary: sdrSummary }),
    })
    if (res.ok) onSuccess()
    else { const d = await res.json(); setError(d.error ?? 'Something went wrong') }
    setSaving(false)
  }

  const fieldCls = 'field'

  return (
    <div className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-panel w-full max-w-lg max-h-[90vh] overflow-y-auto scrollbar-thin animate-slide-up">
        <div className="px-6 py-5 border-b border-[#F1F5F9] flex items-center justify-between">
          <div>
            <h3 className="text-[15px] font-semibold text-[#0F172A] tracking-tight">Add Deal</h3>
            <p className="text-[11px] text-[#94A3B8] mt-0.5">Creates org, KDM, and deal in your pipeline</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#F1F5F9] text-[#94A3B8] transition-colors">
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-5">
          {/* Organisation */}
          <section className="space-y-3">
            <p className="text-label text-[#64748B]">Organisation</p>
            <OrgSearchInput
              required
              value={orgName}
              onChange={setOrgName}
              onOrgSelected={org => {
                setSelectedOrg(org)
                if (org?.location) setLocation(org.location)
              }}
              placeholder="Organisation name"
              inputClassName={fieldCls}
            />
            {selectedOrg && selectedOrg.status !== 'in_database' && (
              <div className="flex items-start gap-1.5 bg-[#FEF3C7] border border-[#FCD34D] rounded-lg px-2.5 py-2">
                <svg className="w-3.5 h-3.5 text-[#92400E] mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
                <p className="text-[11px] text-[#92400E]">
                  <span className="font-semibold">Org already in system</span> · {selectedOrg.status_label}
                  {selectedOrg.assignee_name ? ` · ${selectedOrg.assignee_name}` : ''}.
                  {' '}A new entry will be created.
                </p>
              </div>
            )}
            <input value={location} onChange={e => setLocation(e.target.value)} placeholder="City, State" className={fieldCls} />
          </section>

          {/* KDM */}
          <section className="space-y-3 pt-4 border-t border-[#F1F5F9]">
            <p className="text-label text-[#64748B]">Key Decision Maker</p>
            <input required value={kdmName} onChange={e => setKdmName(e.target.value)} placeholder="Full name" className={fieldCls} />
            <div className="grid grid-cols-2 gap-3">
              <input value={kdmPhone} onChange={e => setKdmPhone(e.target.value)} placeholder="Phone" className={fieldCls} />
              <input value={kdmDesignation} onChange={e => setKdmDesig(e.target.value)} placeholder="Designation" className={fieldCls} />
            </div>
          </section>

          {/* Demo Status */}
          <section className="space-y-3 pt-4 border-t border-[#F1F5F9]">
            <p className="text-label text-[#64748B]">Demo Status</p>
            <div className="flex gap-2">
              {([['tbd', 'TBD'], ['scheduled', 'Scheduled'], ['done', 'Already Done']] as const).map(([v, lbl]) => (
                <button
                  key={v} type="button" onClick={() => setDemoStatus(v)}
                  className={cn('flex-1 py-2 text-[12px] font-medium rounded-xl border transition-all duration-150',
                    demoStatus === v
                      ? 'bg-[#1A56DB] text-white border-[#1A56DB]'
                      : 'border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1]'
                  )}
                >
                  {lbl}
                </button>
              ))}
            </div>
            {demoStatus === 'scheduled' && (
              <DateTimePicker
                value={demoDate}
                onChange={setDemoDate}
                placeholder="Pick demo date & time"
              />
            )}
          </section>

          {/* Deal Details */}
          <section className="space-y-3 pt-4 border-t border-[#F1F5F9]">
            <p className="text-label text-[#64748B]">Deal Details</p>
            <input type="number" value={dealValue} onChange={e => setDealValue(e.target.value)} placeholder="Estimated value (₹)" className={fieldCls} />
            <textarea value={sdrSummary} onChange={e => setSdrSummary(e.target.value)} rows={3} placeholder="Context, pain points, what you know about this org…" className={`${fieldCls} resize-none`} />
          </section>

          {error && <p className="text-[12px] text-[#EF4444] bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving || !orgName.trim() || !kdmName.trim()} className="btn-primary flex-1 py-2.5 text-sm">
              {saving ? 'Adding…' : 'Add to Pipeline'}
            </button>
            <button type="button" onClick={onClose} className="btn-ghost py-2.5 px-5 text-sm">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Pipeline Page ─────────────────────────────────────────────────────────
export default function PipelinePage() {
  const [columns,      setColumns]     = useState<Column[]>([])
  const [loading,      setLoading]     = useState(true)
  const [draggingId,   setDraggingId]  = useState<string | null>(null)
  const [selectedDeal, setSelectedDeal] = useState<DealWithDetails | null>(null)
  const [dealContacts, setDealContacts] = useState<any[]>([])
  const [showAddDeal,   setShowAddDeal]   = useState(false)
  const [showOrgSearch, setShowOrgSearch] = useState(false)
  // Terminal stages collapsed by default
  const [collapsedStages, setCollapsedStages] = useState<Set<DealStage>>(new Set(TERMINAL_STAGES))
  const supabase = createClient()

  useEffect(() => { fetchPipeline() }, [])

  useEffect(() => {
    if (!selectedDeal) { setDealContacts([]); return }
    const orgId = selectedDeal.organization?.id
    if (!orgId) return
    supabase
      .from('contacts')
      .select('*')
      .eq('org_id', orgId)
      .order('is_primary', { ascending: false })
      .then(({ data }) => setDealContacts(data ?? []))
  }, [selectedDeal?.id])

  async function fetchPipeline() {
    const { data: user } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('users').select('id').eq('auth_id', user.user!.id).single()
    if (!profile) return
    const res  = await fetch(`/api/deals?closer_id=${profile.id}`)
    const deals: DealWithDetails[] = await res.json()
    const visible = Array.isArray(deals) ? deals.filter(d => !d.removed_from_board) : []
    setColumns(KANBAN_STAGES.map(stage => ({ stage, deals: visible.filter(d => d.stage === stage) })))
    setLoading(false)
  }

  function toggleCollapse(stage: DealStage) {
    setCollapsedStages(prev => {
      const next = new Set(prev)
      next.has(stage) ? next.delete(stage) : next.add(stage)
      return next
    })
  }

  async function handleDrop(targetStage: DealStage) {
    if (!draggingId) return
    const allDeals = columns.flatMap(c => c.deals)
    const deal = allDeals.find(d => d.id === draggingId)
    if (!deal || deal.stage === targetStage) { setDraggingId(null); return }

    if (targetStage === 'lost') {
      const reason = prompt('Loss reason (required):')
      if (!reason?.trim()) { setDraggingId(null); return }
      await fetch(`/api/deals/${draggingId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage: targetStage, loss_reason: reason }) })
    } else if (targetStage === 'won') {
      const billing = prompt('Billing name (required):')
      if (!billing?.trim()) { setDraggingId(null); return }
      await fetch(`/api/deals/${draggingId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage: targetStage, billing_name: billing }) })
    } else {
      await fetch(`/api/deals/${draggingId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage: targetStage }) })
    }
    setDraggingId(null); fetchPipeline()
  }

  const allDeals   = columns.flatMap(c => c.deals)
  const totalValue = allDeals.filter(d => !TERMINAL_STAGES.includes(d.stage)).reduce((s, d) => s + (d.deal_value ?? 0), 0)

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-[#F8FAFC]">
      <TopBar
        title="Pipeline"
        subtitle={loading ? 'Loading…' : `${allDeals.length} deals · ${formatCurrency(totalValue)} in play`}
        actions={
          <>
            <button
              onClick={() => setShowOrgSearch(true)}
              className="flex items-center gap-1.5 py-2 px-3.5 text-xs font-semibold text-[#374151] border border-[#E2E8F0] rounded-lg hover:bg-[#F1F5F9] transition-colors"
            >
              <Search className="w-3.5 h-3.5" strokeWidth={2} />
              Search Orgs
            </button>
            <button onClick={() => setShowAddDeal(true)} className="btn-primary py-2 px-3.5 text-xs gap-1.5">
              <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
              Add Deal
            </button>
          </>
        }
      />

      {loading ? (
        <div className="flex gap-3 p-4 overflow-hidden">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="flex-shrink-0 w-56">
              <div className="skeleton h-4 w-28 rounded mb-3" />
              <div className="space-y-2">
                {[0, 1, 2].map(j => <CardSkeleton key={j} />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div
          className="flex-1 flex gap-3 p-4 overflow-x-auto scrollbar-thin"
          onDragEnd={() => setDraggingId(null)}
        >
          {columns.map(col => (
            <KanbanColumn
              key={col.stage}
              stage={col.stage}
              deals={col.deals}
              draggingId={draggingId}
              onDrop={handleDrop}
              onDragStart={id => setDraggingId(id)}
              onCardClick={deal => setSelectedDeal(deal)}
              onProposalSent={fetchPipeline}
              collapsed={collapsedStages.has(col.stage)}
              onToggleCollapse={() => toggleCollapse(col.stage)}
            />
          ))}
        </div>
      )}

      {selectedDeal && (
        <DealPanel
          deal={selectedDeal}
          contacts={dealContacts}
          onClose={() => setSelectedDeal(null)}
          onUpdate={fetchPipeline}
          onDelete={(dealId) => {
            setColumns(prev => prev.map(col => ({ ...col, deals: col.deals.filter(d => d.id !== dealId) })))
            setSelectedDeal(null)
          }}
        />
      )}
      {showAddDeal && (
        <AddDealModal onClose={() => setShowAddDeal(false)} onSuccess={() => { setShowAddDeal(false); fetchPipeline() }} />
      )}
      {showOrgSearch && (
        <OrgSearchModal role="closer" onClose={() => setShowOrgSearch(false)} />
      )}
    </div>
  )
}
