'use client'

import { useState, useEffect } from 'react'
import TopBar from '@/components/layout/TopBar'
import { createClient } from '@/lib/supabase/client'
import { KANBAN_STAGES, DEAL_STAGE_LABELS, DEAL_STAGE_COLORS } from '@/lib/constants'
import { formatCurrency } from '@/lib/utils'
import type { DealStage } from '@/types/database'
import { X, Send, Trash2, IndianRupee, Calendar, GripVertical, Plus } from 'lucide-react'
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
  organization: { id: string; name: string; location: string | null; annual_revenue: number | null }
  demo?: { id: string; demo_date: string; sdr_summary: string; sdr_interest_signal: string | null; sdr: { id: string; name: string } | null }
}

interface Column { stage: DealStage; deals: DealWithDetails[] }

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
  onProposalSent: (dealId: string) => void
}) {
  const [markingProposal, setMarkingProposal] = useState(false)
  const daysInStage = Math.floor((Date.now() - new Date(deal.updated_at).getTime()) / 86400000)
  const isStale = daysInStage > 7 && !['won', 'lost', 'ghosted'].includes(deal.stage)

  async function handleProposalClick(e: React.MouseEvent) {
    e.stopPropagation() // don't open the side panel
    setMarkingProposal(true)
    await fetch(`/api/deals/${deal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proposal_sent_at: new Date().toISOString(),
        stage: 'follow_up',
      }),
    })
    setMarkingProposal(false)
    onProposalSent(deal.id)
  }

  return (
    <div
      draggable
      onDragStart={() => onDragStart(deal.id)}
      onClick={() => onClick(deal)}
      className={`bg-white rounded-lg border p-3 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-all group select-none ${
        isStale ? 'border-[#F59E0B]' : 'border-[#E2E8F0]'
      }`}
    >
      <div className="flex items-start gap-1.5">
        <GripVertical className="w-3.5 h-3.5 text-[#CBD5E1] mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1 mb-1">
            <p className="font-medium text-xs text-[#0F172A] leading-tight line-clamp-2">{deal.organization?.name}</p>
            {isStale && (
              <span className="shrink-0 text-[9px] font-semibold text-[#F59E0B] bg-amber-50 px-1.5 py-0.5 rounded ml-1">STALE</span>
            )}
          </div>
          <p className={`text-sm font-bold ${deal.deal_value ? 'text-[#0F172A]' : 'text-[#94A3B8]'}`}>
            {deal.deal_value ? formatCurrency(deal.deal_value) : 'No value set'}
          </p>
          <div className="flex items-center justify-between mt-1.5 text-[10px] text-[#94A3B8]">
            <span className="truncate">{deal.organization?.location ?? '—'}</span>
            <span className="shrink-0 ml-1">
              {deal.next_follow_up
                ? `FU: ${new Date(deal.next_follow_up).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
                : `${daysInStage}d`}
            </span>
          </div>

          {/* Proposal badge (already sent) */}
          {deal.proposal_sent_at && (
            <div className="mt-1.5">
              <span className="text-[9px] text-[#0891B2] bg-cyan-50 px-1.5 py-0.5 rounded-full font-medium">✓ Proposal sent</span>
            </div>
          )}

          {/* Proposal Sent button — only on demo_done cards where proposal not yet sent */}
          {deal.stage === 'demo_done' && !deal.proposal_sent_at && (
            <button
              onClick={handleProposalClick}
              disabled={markingProposal}
              className="mt-2 w-full flex items-center justify-center gap-1 py-1 bg-cyan-50 border border-cyan-200 text-[#0891B2] text-[10px] font-semibold rounded-lg hover:bg-cyan-100 disabled:opacity-50 transition-colors"
            >
              <Send className="w-2.5 h-2.5" />
              {markingProposal ? 'Saving...' : 'Mark Proposal Sent →'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Droppable Column ───────────────────────────────────────────────────────────
function KanbanColumn({
  stage, deals, draggingId, onDrop, onDragStart, onCardClick, onProposalSent,
}: {
  stage: DealStage
  deals: DealWithDetails[]
  draggingId: string | null
  onDrop: (stage: DealStage) => void
  onDragStart: (id: string) => void
  onCardClick: (deal: DealWithDetails) => void
  onProposalSent: (dealId: string) => void
}) {
  const [isOver, setIsOver] = useState(false)
  const color = DEAL_STAGE_COLORS[stage]
  const colValue = deals.reduce((s, d) => s + (d.deal_value ?? 0), 0)

  return (
    <div className="flex-shrink-0 w-60 flex flex-col">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-xs font-semibold text-[#0F172A]">{DEAL_STAGE_LABELS[stage]}</span>
        </div>
        <span className="text-xs text-[#94A3B8] bg-[#F1F5F9] px-1.5 py-0.5 rounded-full">{deals.length}</span>
      </div>

      <div
        onDragOver={e => { e.preventDefault(); setIsOver(true) }}
        onDragLeave={() => setIsOver(false)}
        onDrop={() => { setIsOver(false); onDrop(stage) }}
        className="flex-1 min-h-24 rounded-xl p-2 space-y-2 transition-all"
        style={{
          backgroundColor: `${color}08`,
          outline: isOver ? `2px solid ${color}` : 'none',
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
            className="flex items-center justify-center h-16 rounded-lg border-2 border-dashed transition-colors"
            style={isOver ? { borderColor: color } : { borderColor: '#E2E8F0' }}
          >
            <p className="text-xs text-[#CBD5E1]">Drop here</p>
          </div>
        )}
      </div>

      {deals.length > 0 && (
        <p className="text-center text-[10px] text-[#94A3B8] mt-1.5">{formatCurrency(colValue)}</p>
      )}
    </div>
  )
}

// ── Deal Detail Panel ──────────────────────────────────────────────────────────
function DealPanel({
  deal, onClose, onUpdate,
}: {
  deal: DealWithDetails
  onClose: () => void
  onUpdate: () => void
}) {
  const [dealValue, setDealValue] = useState(deal.deal_value?.toString() ?? '')
  const [followUpDate, setFollowUpDate] = useState(deal.next_follow_up ?? '')
  const [lossReason, setLossReason] = useState(deal.loss_reason ?? '')
  const [billingName, setBillingName] = useState(deal.billing_name ?? '')
  const [saving, setSaving] = useState(false)
  const [removingFromBoard, setRemovingFromBoard] = useState(false)

  async function save() {
    setSaving(true)
    const payload: Record<string, unknown> = {}
    if (dealValue) payload.deal_value = parseInt(dealValue)
    if (followUpDate) payload.next_follow_up = followUpDate
    if (lossReason) payload.loss_reason = lossReason
    if (billingName) payload.billing_name = billingName

    await fetch(`/api/deals/${deal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSaving(false)
    onUpdate()
    onClose()
  }

  async function removeFromBoard() {
    setRemovingFromBoard(true)
    await fetch(`/api/deals/${deal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ removed_from_board: true }),
    })
    setRemovingFromBoard(false)
    onUpdate()
    onClose()
  }

  const demoDate = deal.demo?.demo_date
    ? new Date(deal.demo.demo_date).toLocaleDateString('en-IN', {
        weekday: 'short', day: 'numeric', month: 'short',
        hour: '2-digit', minute: '2-digit', hour12: true,
      })
    : null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white h-full shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-start justify-between">
          <div>
            <p className="font-semibold text-[#0F172A]">{deal.organization?.name}</p>
            <p className="text-xs text-[#94A3B8] mt-0.5">{deal.organization?.location}</p>
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: DEAL_STAGE_COLORS[deal.stage] }}>
                {DEAL_STAGE_LABELS[deal.stage]}
              </span>
              {deal.proposal_sent_at && (
                <span className="text-[10px] text-[#0891B2] bg-cyan-50 px-1.5 py-0.5 rounded-full font-medium">✓ Proposal sent</span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#94A3B8]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* SDR Context */}
          {deal.demo?.sdr_summary && (
            <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#F1F5F9]">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8] mb-1.5">
                SDR Notes{deal.demo.sdr?.name ? ` — ${deal.demo.sdr.name}` : ''}
              </p>
              <p className="text-xs text-[#0F172A] leading-relaxed">{deal.demo.sdr_summary}</p>
              {deal.demo.sdr_interest_signal && (
                <p className="text-[10px] text-[#64748B] mt-1.5">Signal: <span className="font-medium capitalize">{deal.demo.sdr_interest_signal}</span></p>
              )}
              {demoDate && (
                <p className="text-[10px] text-[#64748B] mt-0.5">Demo: {demoDate}</p>
              )}
            </div>
          )}

          {/* Deal Value */}
          <div>
            <label className="text-xs font-semibold text-[#64748B] uppercase tracking-widest mb-1.5 block">Deal Value (₹)</label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8]" />
              <input
                type="number"
                value={dealValue}
                onChange={e => setDealValue(e.target.value)}
                placeholder="e.g. 50000"
                className="w-full pl-8 pr-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20 focus:border-[#1A56DB]"
              />
            </div>
          </div>

          {/* Next Follow-up */}
          <div>
            <label className="text-xs font-semibold text-[#64748B] uppercase tracking-widest mb-1.5 block">Next Follow-up Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8]" />
              <input
                type="date"
                value={followUpDate}
                onChange={e => setFollowUpDate(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20"
              />
            </div>
          </div>

          {/* Loss Reason */}
          {deal.stage === 'lost' && (
            <div>
              <label className="text-xs font-semibold text-[#EF4444] uppercase tracking-widest mb-1.5 block">Loss Reason *</label>
              <textarea
                value={lossReason}
                onChange={e => setLossReason(e.target.value)}
                placeholder="Why was this deal lost?"
                rows={3}
                className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#EF4444]/20 focus:border-[#EF4444] resize-none"
              />
            </div>
          )}

          {/* Billing Name */}
          {deal.stage === 'won' && (
            <div>
              <label className="text-xs font-semibold text-[#059669] uppercase tracking-widest mb-1.5 block">Billing Name *</label>
              <input
                type="text"
                value={billingName}
                onChange={e => setBillingName(e.target.value)}
                placeholder="Organisation billing name"
                className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#059669]/20 focus:border-[#059669]"
              />
            </div>
          )}

          {/* Ghosted — Remove from board */}
          {deal.stage === 'ghosted' && (
            <div className="p-3 bg-red-50 rounded-lg border border-red-100">
              <p className="text-xs text-[#64748B] mb-2">Org has gone dark. Remove from board to declutter — the record stays in your database.</p>
              <button
                onClick={removeFromBoard}
                disabled={removingFromBoard}
                className="flex items-center gap-1.5 px-4 py-2 border border-[#EF4444] text-[#EF4444] text-xs font-medium rounded-lg hover:bg-red-50 disabled:opacity-60 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {removingFromBoard ? 'Removing...' : 'Remove from Board'}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[#E2E8F0]">
          <button
            onClick={save}
            disabled={saving}
            className="w-full py-2.5 bg-[#1A56DB] text-white text-sm font-semibold rounded-xl hover:bg-[#1e40af] disabled:opacity-60 transition-colors"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Add Deal Modal ─────────────────────────────────────────────────────────────
function AddDealModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: () => void
}) {
  const [orgName, setOrgName] = useState('')
  const [location, setLocation] = useState('')
  const [kdmName, setKdmName] = useState('')
  const [kdmPhone, setKdmPhone] = useState('')
  const [kdmDesignation, setKdmDesignation] = useState('')
  const [dealValue, setDealValue] = useState('')
  const [demoStatus, setDemoStatus] = useState<'tbd' | 'scheduled' | 'done'>('tbd')
  const [demoDate, setDemoDate] = useState('')
  const [sdrSummary, setSdrSummary] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (demoStatus === 'scheduled' && !demoDate) {
      setError('Please pick a demo date & time.')
      return
    }
    setSaving(true)
    const res = await fetch('/api/deals/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        org_name: orgName,
        location,
        kdm_name: kdmName,
        kdm_phone: kdmPhone,
        kdm_designation: kdmDesignation,
        deal_value: dealValue || null,
        demo_status: demoStatus,
        demo_date: demoDate || null,
        sdr_summary: sdrSummary,
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
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="font-semibold text-[#0F172A] text-base">Add Deal Manually</h3>
            <p className="text-xs text-[#64748B] mt-0.5">Creates org → KDM → deal in your pipeline</p>
          </div>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#64748B] text-xl leading-none">×</button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {/* Organisation */}
          <div className="space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8]">Organisation</p>
            <div>
              <label className="block text-xs text-[#64748B] mb-1">Name <span className="text-red-500">*</span></label>
              <input
                required
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
                placeholder="Org name"
                className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20"
              />
            </div>
            <div>
              <label className="block text-xs text-[#64748B] mb-1">Location</label>
              <input
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="City, State"
                className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20"
              />
            </div>
          </div>

          {/* KDM */}
          <div className="space-y-3 pt-2 border-t border-[#F1F5F9]">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8]">Key Decision Maker</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
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
                <label className="block text-xs text-[#64748B] mb-1">Phone</label>
                <input
                  value={kdmPhone}
                  onChange={e => setKdmPhone(e.target.value)}
                  placeholder="+91 98765 43210"
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
          </div>

          {/* Demo status */}
          <div className="space-y-3 pt-2 border-t border-[#F1F5F9]">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8]">Demo Status</p>
            <div className="flex gap-2">
              {([
                { value: 'tbd', label: '📅 TBD' },
                { value: 'scheduled', label: '🕐 Scheduled' },
                { value: 'done', label: '✅ Already Done' },
              ] as const).map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDemoStatus(opt.value)}
                  className={cn(
                    'flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors',
                    demoStatus === opt.value
                      ? 'bg-[#1A56DB] text-white border-[#1A56DB]'
                      : 'border-[#E2E8F0] text-[#64748B] hover:border-[#1A56DB]/40'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {demoStatus === 'scheduled' && (
              <div>
                <label className="block text-xs text-[#64748B] mb-1">Demo Date & Time <span className="text-red-500">*</span></label>
                <input
                  type="datetime-local"
                  value={demoDate}
                  onChange={e => setDemoDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20"
                />
              </div>
            )}
          </div>

          {/* Deal value + context */}
          <div className="space-y-3 pt-2 border-t border-[#F1F5F9]">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8]">Deal Details</p>
            <div>
              <label className="block text-xs text-[#64748B] mb-1">Estimated Deal Value (₹)</label>
              <input
                type="number"
                value={dealValue}
                onChange={e => setDealValue(e.target.value)}
                placeholder="e.g. 75000"
                className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20"
              />
            </div>
            <div>
              <label className="block text-xs text-[#64748B] mb-1">Context / Notes</label>
              <textarea
                value={sdrSummary}
                onChange={e => setSdrSummary(e.target.value)}
                rows={3}
                placeholder="How did you find them? Key pain points, budget signals, what to expect..."
                className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20 resize-none"
              />
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={saving || !orgName.trim() || !kdmName.trim()}
              className="flex-1 py-2.5 bg-[#1A56DB] text-white text-sm font-medium rounded-xl hover:bg-[#1e40af] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Adding...' : 'Add to Pipeline →'}
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

// ── Main Pipeline Page ─────────────────────────────────────────────────────────
export default function PipelinePage() {
  const [columns, setColumns] = useState<Column[]>([])
  const [loading, setLoading] = useState(true)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [selectedDeal, setSelectedDeal] = useState<DealWithDetails | null>(null)
  const [showAddDeal, setShowAddDeal] = useState(false)
  const supabase = createClient()

  useEffect(() => { fetchPipeline() }, [])

  async function fetchPipeline() {
    const { data: user } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('users').select('id').eq('auth_id', user.user!.id).single()
    if (!profile) return

    const res = await fetch(`/api/deals?closer_id=${profile.id}`)
    const deals: DealWithDetails[] = await res.json()

    const visible = Array.isArray(deals) ? deals.filter(d => !d.removed_from_board) : []
    const grouped = KANBAN_STAGES.map(stage => ({
      stage,
      deals: visible.filter(d => d.stage === stage),
    }))
    setColumns(grouped)
    setLoading(false)
  }

  // Called when Proposal Sent is clicked on a card — optimistically remove from demo_done column
  function handleProposalSentOnCard(dealId: string) {
    fetchPipeline()
  }

  async function handleDrop(targetStage: DealStage) {
    if (!draggingId) return

    const allDeals = columns.flatMap(c => c.deals)
    const deal = allDeals.find(d => d.id === draggingId)
    if (!deal || deal.stage === targetStage) { setDraggingId(null); return }

    if (targetStage === 'lost') {
      const reason = prompt('Loss reason is required (the record stays in your database):')
      if (!reason?.trim()) { setDraggingId(null); return }
      await fetch(`/api/deals/${draggingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: targetStage, loss_reason: reason }),
      })
    } else if (targetStage === 'won') {
      const billing = prompt('Billing name is required:')
      if (!billing?.trim()) { setDraggingId(null); return }
      await fetch(`/api/deals/${draggingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: targetStage, billing_name: billing }),
      })
    } else {
      await fetch(`/api/deals/${draggingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: targetStage }),
      })
    }

    setDraggingId(null)
    fetchPipeline()
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#1A56DB] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const allDeals = columns.flatMap(c => c.deals)
  const totalValue = allDeals
    .filter(d => !['lost', 'ghosted'].includes(d.stage))
    .reduce((s, d) => s + (d.deal_value ?? 0), 0)

  return (
    <div className="flex-1 flex flex-col">
      <TopBar
        title="Active Pipeline"
        subtitle={`${allDeals.length} deals · ${formatCurrency(totalValue)} pipeline value`}
      />

      {/* Add deal button */}
      <div className="px-4 pt-3 pb-1 flex justify-end">
        <button
          onClick={() => setShowAddDeal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-[#1A56DB] text-white text-xs font-semibold rounded-lg hover:bg-[#1e40af] transition-colors shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Deal
        </button>
      </div>

      <div
        className="flex-1 flex gap-3 p-4 overflow-x-auto"
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
            onProposalSent={handleProposalSentOnCard}
          />
        ))}
      </div>

      {selectedDeal && (
        <DealPanel
          deal={selectedDeal}
          onClose={() => setSelectedDeal(null)}
          onUpdate={fetchPipeline}
        />
      )}

      {showAddDeal && (
        <AddDealModal
          onClose={() => setShowAddDeal(false)}
          onSuccess={() => { setShowAddDeal(false); fetchPipeline() }}
        />
      )}
    </div>
  )
}
