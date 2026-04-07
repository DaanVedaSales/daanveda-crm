'use client'

import { useState, useEffect } from 'react'
import TopBar from '@/components/layout/TopBar'
import { createClient } from '@/lib/supabase/client'
import { KANBAN_STAGES, DEAL_STAGE_LABELS, DEAL_STAGE_COLORS } from '@/lib/constants'
import { formatCurrency, formatRelativeDate } from '@/lib/utils'
import { DndContext, DragEndEvent, DragOverlay, closestCenter } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { Deal, DealStage } from '@/types/database'

interface DealWithDetails extends Deal {
  organization: { id: string; name: string; location: string | null; annual_revenue: number | null }
  demo?: { sdr_summary: string; sdr?: { name: string } }
}

interface Column { stage: DealStage; deals: DealWithDetails[] }

export default function PipelinePage() {
  const [columns, setColumns] = useState<Column[]>([])
  const [loading, setLoading] = useState(true)
  const [activeDeal, setActiveDeal] = useState<DealWithDetails | null>(null)
  const supabase = createClient()

  useEffect(() => { fetchPipeline() }, [])

  async function fetchPipeline() {
    const { data: user } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('users').select('id').eq('auth_id', user.user!.id).single()
    if (!profile) return

    const res = await fetch(`/api/deals?closer_id=${profile.id}`)
    const deals: DealWithDetails[] = await res.json()

    const grouped = KANBAN_STAGES.map(stage => ({
      stage,
      deals: deals.filter(d => d.stage === stage),
    }))
    setColumns(grouped)
    setLoading(false)
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const newStage = over.id as DealStage
    const dealId = active.id as string

    // Optimistic update
    setColumns(prev =>
      prev.map(col => ({
        ...col,
        deals: col.deals.filter(d => d.id !== dealId),
      })).map(col =>
        col.stage === newStage
          ? { ...col, deals: [...col.deals, ...(columns.flatMap(c => c.deals).filter(d => d.id === dealId))] }
          : col
      )
    )

    // Validate mandatory fields before allowing stage change to won/lost
    if (newStage === 'lost' || newStage === 'won') {
      const reason = newStage === 'lost'
        ? prompt('Loss reason is required:')
        : null
      const billing = newStage === 'won'
        ? prompt('Billing name is required:')
        : null

      if (newStage === 'lost' && !reason) { fetchPipeline(); return }
      if (newStage === 'won' && !billing) { fetchPipeline(); return }

      await fetch(`/api/deals/${dealId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: newStage, loss_reason: reason, billing_name: billing }),
      })
    } else {
      await fetch(`/api/deals/${dealId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: newStage }),
      })
    }

    fetchPipeline()
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#1A56DB] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const totalValue = columns.flatMap(c => c.deals).reduce((sum, d) => sum + (d.deal_value ?? 0), 0)

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title="Active Pipeline" subtitle={`${columns.flatMap(c => c.deals).length} deals · ${formatCurrency(totalValue)} total value`} />

      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="flex-1 flex gap-3 p-4 overflow-x-auto">
          {columns.map(col => (
            <div key={col.stage} className="flex-shrink-0 w-64 flex flex-col">
              {/* Column header */}
              <div className="flex items-center justify-between mb-2 px-1">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: DEAL_STAGE_COLORS[col.stage] }} />
                  <span className="text-xs font-semibold text-[#0F172A]">{DEAL_STAGE_LABELS[col.stage]}</span>
                </div>
                <span className="text-xs text-[#94A3B8] bg-[#F1F5F9] px-1.5 py-0.5 rounded-full">{col.deals.length}</span>
              </div>

              {/* Drop zone */}
              <SortableContext
                items={col.deals.map(d => d.id)}
                strategy={verticalListSortingStrategy}
                id={col.stage}
              >
                <div
                  className="flex-1 min-h-24 rounded-xl p-2 space-y-2"
                  style={{ backgroundColor: `${DEAL_STAGE_COLORS[col.stage]}08` }}
                  data-stage={col.stage}
                  id={col.stage}
                >
                  {col.deals.map(deal => {
                    const daysInStage = Math.floor((Date.now() - new Date(deal.updated_at).getTime()) / 86400000)
                    const isStale = daysInStage > 7
                    return (
                      <div
                        key={deal.id}
                        className={`bg-white rounded-lg border p-3 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-all ${
                          isStale ? 'border-[#F59E0B]' : 'border-[#E2E8F0]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1 mb-1.5">
                          <p className="font-medium text-xs text-[#0F172A] leading-tight line-clamp-1">
                            {deal.organization?.name}
                          </p>
                          {isStale && (
                            <span className="shrink-0 text-[9px] font-semibold text-[#F59E0B] bg-amber-50 px-1.5 py-0.5 rounded">STALE</span>
                          )}
                        </div>
                        <p className="text-sm font-bold text-[#059669]">
                          {deal.deal_value ? formatCurrency(deal.deal_value) : 'No value yet'}
                        </p>
                        <div className="flex items-center justify-between mt-2 text-[10px] text-[#94A3B8]">
                          <span>{deal.organization?.location ?? '—'}</span>
                          <span>
                            {deal.next_follow_up
                              ? `FU: ${formatRelativeDate(deal.next_follow_up)}`
                              : `${daysInStage}d in stage`}
                          </span>
                        </div>
                      </div>
                    )
                  })}

                  {col.deals.length === 0 && (
                    <div className="flex items-center justify-center h-16 rounded-lg border-2 border-dashed border-[#E2E8F0]">
                      <p className="text-xs text-[#CBD5E1]">Drop here</p>
                    </div>
                  )}
                </div>
              </SortableContext>

              {/* Column total */}
              {col.deals.length > 0 && (
                <p className="text-center text-[10px] text-[#94A3B8] mt-1.5">
                  {formatCurrency(col.deals.reduce((s, d) => s + (d.deal_value ?? 0), 0))}
                </p>
              )}
            </div>
          ))}
        </div>
      </DndContext>
    </div>
  )
}
