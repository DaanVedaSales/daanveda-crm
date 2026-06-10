'use client'

import { useState, useEffect, useCallback } from 'react'
import TopBar from '@/components/layout/TopBar'
import KpiCard from '@/components/dashboard/KpiCard'
import PayoutSummary from '@/components/dashboard/PayoutSummary'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { X, TrendingUp, Users, ChevronRight, CalendarDays } from 'lucide-react'
import Link from 'next/link'

// ── Types ──────────────────────────────────────────────────────────────────────
interface SdrStat {
  user_id: string
  name: string
  role: 'sdr'
  monthly_demo_target: number | null
  leads_assigned: number
  demos_booked: number
  demos_attended: number
  leads_reached_out: number
  cold_call_to_demo_pct: number | null
  no_shows: number
  show_up_rate: number | null
  unqualified: number
  unqualified_pct: number | null
  already_converted: number
  achievement_pct: number | null
}

interface CloserStat {
  user_id: string
  name: string
  role: 'closer'
  monthly_revenue_target: number | null
  demos_done: number
  converted: number
  revenue_won: number
  conversion_pct: number | null
  asp: number | null
  in_pipeline: number
  interested: number
  follows_on_track: number
  avg_deal_cycle: number | null
  achievement_pct: number | null
}

interface OrgKpis {
  totalLeads: number
  unassignedLeads: number
  totalRevTarget: number
}

type Period = 'today' | 'week' | 'month' | 'all' | 'custom'

const PERIOD_LABELS: Record<Period, string> = {
  today: 'Today',
  week: 'This Week',
  month: 'This Month',
  all: 'All Time',
  custom: 'Custom',
}

// ── Period Filter Bar ──────────────────────────────────────────────────────────
function PeriodBar({
  period, onPeriod,
  customStart, customEnd,
  onCustomStart, onCustomEnd,
}: {
  period: Period
  onPeriod: (p: Period) => void
  customStart: string
  customEnd: string
  onCustomStart: (v: string) => void
  onCustomEnd: (v: string) => void
}) {
  const [showCustom, setShowCustom] = useState(false)

  function selectPeriod(p: Period) {
    if (p === 'custom') {
      setShowCustom(true)
    } else {
      setShowCustom(false)
      onPeriod(p)
    }
  }

  function applyCustom() {
    if (customStart && customEnd) {
      onPeriod('custom')
      setShowCustom(false)
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center bg-white border border-[#E2E8F0] rounded-xl p-1 gap-0.5"
           style={{ boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}>
        {(['today', 'week', 'month', 'all'] as Period[]).map(p => (
          <button
            key={p}
            onClick={() => selectPeriod(p)}
            className={cn(
              'px-3.5 py-1.5 rounded-lg text-[12px] font-medium transition-all',
              period === p
                ? 'bg-[#1A56DB] text-white shadow-sm'
                : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
            )}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
        <button
          onClick={() => selectPeriod('custom')}
          className={cn(
            'flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-medium transition-all',
            period === 'custom'
              ? 'bg-[#1A56DB] text-white shadow-sm'
              : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
          )}
        >
          <CalendarDays className="w-3 h-3" strokeWidth={2} />
          {period === 'custom' && customStart && customEnd
            ? `${customStart} → ${customEnd}`
            : 'Custom Range'
          }
        </button>
      </div>

      {/* Custom date range picker — inline dropdown */}
      {showCustom && (
        <div className="flex items-center gap-2 bg-white border border-[#E2E8F0] rounded-xl px-3 py-2"
             style={{ boxShadow: '0 4px 12px rgba(15,23,42,0.08)' }}>
          <label className="text-[11px] text-[#94A3B8] font-medium">From</label>
          <input
            type="date"
            value={customStart}
            onChange={e => onCustomStart(e.target.value)}
            className="text-[12px] border border-[#E2E8F0] rounded-lg px-2 py-1 focus:outline-none focus:border-[#1A56DB]"
          />
          <label className="text-[11px] text-[#94A3B8] font-medium">To</label>
          <input
            type="date"
            value={customEnd}
            onChange={e => onCustomEnd(e.target.value)}
            className="text-[12px] border border-[#E2E8F0] rounded-lg px-2 py-1 focus:outline-none focus:border-[#1A56DB]"
          />
          <button
            onClick={applyCustom}
            disabled={!customStart || !customEnd}
            className="px-3 py-1.5 bg-[#1A56DB] text-white text-[11px] font-semibold rounded-lg disabled:opacity-40 hover:bg-[#1A3DB5] transition-colors"
          >
            Apply
          </button>
          <button
            onClick={() => setShowCustom(false)}
            className="p-1 text-[#94A3B8] hover:text-[#374151] transition-colors"
          >
            <X className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
        </div>
      )}
    </div>
  )
}

// ── SDR Slide-in Panel ─────────────────────────────────────────────────────────
function SdrPanel({ sdr, onClose }: { sdr: SdrStat; onClose: () => void }) {
  const isPipRisk = (sdr.achievement_pct ?? 0) < 60
  const isBehind = (sdr.achievement_pct ?? 0) >= 60 && (sdr.achievement_pct ?? 0) < 85

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-[#0F172A]/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-[360px] bg-white h-full shadow-panel flex flex-col animate-slide-in-right">
        <div className="px-5 py-4 border-b border-[#F1F5F9] flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-full bg-[#1A56DB]/10 flex items-center justify-center">
                <span className="text-[#1A56DB] text-sm font-semibold">{sdr.name.charAt(0)}</span>
              </div>
              <div>
                <p className="font-semibold text-[14px] text-[#0F172A]">{sdr.name}</p>
                <p className="text-[11px] text-[#94A3B8]">SDR</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              {isPipRisk ? (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-500 text-white">PIP RISK</span>
              ) : isBehind ? (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-amber-300 text-amber-700">Behind</span>
              ) : (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-green-300 text-green-700">On Track</span>
              )}
              {sdr.achievement_pct !== null && (
                <span className="text-[11px] font-semibold text-[#0F172A]">{sdr.achievement_pct}% of target</span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#F1F5F9] text-[#94A3B8] transition-colors">
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Hero metric */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 bg-[#EFF6FF] rounded-xl">
              <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider mb-1">Demos Booked</p>
              <p className="text-[24px] font-bold text-[#1A56DB] leading-none">{sdr.demos_booked}</p>
              <p className="text-[11px] text-[#94A3B8] mt-1">
                Target: {sdr.monthly_demo_target ?? '—'}
              </p>
            </div>
            <div className="p-4 bg-[#F0FDF4] rounded-xl">
              <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider mb-1">Achievement</p>
              <p className={cn('text-[24px] font-bold leading-none', isPipRisk ? 'text-[#EF4444]' : isBehind ? 'text-[#F59E0B]' : 'text-[#059669]')}>
                {sdr.achievement_pct !== null ? `${sdr.achievement_pct}%` : '—'}
              </p>
              <p className="text-[11px] text-[#94A3B8] mt-1">of monthly target</p>
            </div>
          </div>

          {/* Outreach metrics */}
          <div className="bg-[#F8FAFC] rounded-xl border border-[#F1F5F9] overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[#F1F5F9]">
              <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">Outreach</p>
            </div>
            <div className="divide-y divide-[#F1F5F9]">
              <StatRow label="Leads Assigned" value={sdr.leads_assigned} />
              <StatRow label="Leads Reached Out" value={sdr.leads_reached_out} />
              <StatRow label="Cold Call → Demo %" value={sdr.cold_call_to_demo_pct !== null ? `${sdr.cold_call_to_demo_pct}%` : '—'} />
            </div>
          </div>

          {/* Show-up quality */}
          <div className="bg-[#F8FAFC] rounded-xl border border-[#F1F5F9] overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[#F1F5F9]">
              <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">Demo Quality</p>
            </div>
            <div className="divide-y divide-[#F1F5F9]">
              <StatRow
                label="Show-up Rate"
                value={sdr.show_up_rate !== null ? `${sdr.show_up_rate}%` : '< 3 demos'}
                valueClass={sdr.show_up_rate !== null ? (sdr.show_up_rate >= 70 ? 'text-[#059669]' : 'text-[#EF4444]') : 'text-[#94A3B8]'}
              />
              <StatRow label="No-Shows" value={sdr.no_shows} />
              <StatRow label="Unqualified (by Closer)" value={sdr.unqualified} />
              <StatRow
                label="Unqualified %"
                value={sdr.unqualified_pct !== null ? `${sdr.unqualified_pct}%` : '—'}
                valueClass={(sdr.unqualified_pct ?? 0) > 25 ? 'text-[#EF4444]' : (sdr.unqualified_pct ?? 0) > 15 ? 'text-[#F59E0B]' : 'text-[#64748B]'}
              />
              <StatRow label="Already Converted" value={sdr.already_converted} valueClass="text-[#059669]" />
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

// ── Closer Slide-in Panel ──────────────────────────────────────────────────────
function CloserPanel({ closer, totalRevenue, onClose }: { closer: CloserStat; totalRevenue: number; onClose: () => void }) {
  const isPipRisk = (closer.achievement_pct ?? 0) < 60
  const isBehind = (closer.achievement_pct ?? 0) >= 60 && (closer.achievement_pct ?? 0) < 85
  const contribution = totalRevenue > 0 ? Math.round((closer.revenue_won / totalRevenue) * 100) : 0

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-[#0F172A]/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-[360px] bg-white h-full shadow-panel flex flex-col animate-slide-in-right">
        <div className="px-5 py-4 border-b border-[#F1F5F9] flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-full bg-[#059669]/10 flex items-center justify-center">
                <span className="text-[#059669] text-sm font-semibold">{closer.name.charAt(0)}</span>
              </div>
              <div>
                <p className="font-semibold text-[14px] text-[#0F172A]">{closer.name}</p>
                <p className="text-[11px] text-[#94A3B8]">Closer</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              {isPipRisk ? (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-500 text-white">PIP RISK</span>
              ) : isBehind ? (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-amber-300 text-amber-700">Behind</span>
              ) : (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-green-300 text-green-700">On Track</span>
              )}
              {closer.achievement_pct !== null && (
                <span className="text-[11px] font-semibold text-[#0F172A]">{closer.achievement_pct}% of target</span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#F1F5F9] text-[#94A3B8] transition-colors">
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Hero metrics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 bg-[#F0FDF4] rounded-xl">
              <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider mb-1">Revenue Won</p>
              <p className="text-[20px] font-bold text-[#059669] leading-none">{formatCurrency(closer.revenue_won)}</p>
              <p className="text-[11px] text-[#94A3B8] mt-1">{contribution}% of team total</p>
            </div>
            <div className="p-4 bg-[#EFF6FF] rounded-xl">
              <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider mb-1">Achievement</p>
              <p className={cn('text-[20px] font-bold leading-none', isPipRisk ? 'text-[#EF4444]' : isBehind ? 'text-[#F59E0B]' : 'text-[#059669]')}>
                {closer.achievement_pct !== null ? `${closer.achievement_pct}%` : '—'}
              </p>
              <p className="text-[11px] text-[#94A3B8] mt-1">
                Target: {closer.monthly_revenue_target ? formatCurrency(closer.monthly_revenue_target) : '—'}
              </p>
            </div>
          </div>

          {/* Demo performance */}
          <div className="bg-[#F8FAFC] rounded-xl border border-[#F1F5F9] overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[#F1F5F9]">
              <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">Demo Performance</p>
            </div>
            <div className="divide-y divide-[#F1F5F9]">
              <StatRow label="Demos Done" value={closer.demos_done} />
              <StatRow label="Converted (Won)" value={closer.converted} valueClass="text-[#059669]" />
              <StatRow
                label="Conversion %"
                value={closer.conversion_pct !== null ? `${closer.conversion_pct}%` : '—'}
                valueClass={(closer.conversion_pct ?? 0) >= 12 ? 'text-[#059669]' : 'text-[#F59E0B]'}
              />
              <StatRow label="Avg Deal Cycle" value={closer.avg_deal_cycle !== null ? `${closer.avg_deal_cycle}d` : '—'} />
            </div>
          </div>

          {/* Pipeline health */}
          <div className="bg-[#F8FAFC] rounded-xl border border-[#F1F5F9] overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[#F1F5F9]">
              <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">Pipeline Health</p>
            </div>
            <div className="divide-y divide-[#F1F5F9]">
              <StatRow label="In Pipeline" value={closer.in_pipeline} />
              <StatRow label="Interested (FU + Neg)" value={closer.interested} />
              <StatRow label="Follows on Track" value={closer.follows_on_track} valueClass="text-[#059669]" />
              <StatRow label="Avg Selling Price" value={closer.asp !== null ? formatCurrency(closer.asp) : '—'} />
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

function StatRow({ label, value, valueClass }: { label: string; value: string | number; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <p className="text-[12px] text-[#64748B]">{label}</p>
      <p className={cn('text-[13px] font-semibold text-[#0F172A] tabular-nums', valueClass)}>{value}</p>
    </div>
  )
}

// ── Stat Chip ──────────────────────────────────────────────────────────────────
function AggChip({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="flex flex-col items-center px-4 py-2 bg-white rounded-xl border border-[#E2E8F0]"
         style={{ boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}>
      <p className="text-[18px] font-bold tabular-nums" style={{ color: accent ?? '#0F172A' }}>{value}</p>
      <p className="text-[10px] text-[#94A3B8] font-medium mt-0.5">{label}</p>
    </div>
  )
}

// ── Conversion Funnel ───────────────────────────────────────────────────────────
interface FunnelData {
  leads_assigned: { total: number; admin_pool: number; sdr_manual: number; sdr_claim: number }
  demos_booked: number
  demos_attended: number
  deals_won: number
  deals_lost_ghosted: number
}

function FunnelStrip({ funnel, loading, periodLabel }: { funnel: FunnelData | null; loading: boolean; periodLabel: string }) {
  const convPct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) : null)

  const stages = funnel
    ? [
        { label: 'Leads Assigned', value: funnel.leads_assigned.total, color: '#1A56DB', conv: null as number | null },
        { label: 'Demos Booked', value: funnel.demos_booked, color: '#7C3AED', conv: convPct(funnel.demos_booked, funnel.leads_assigned.total) },
        { label: 'Demos Attended', value: funnel.demos_attended, color: '#0891B2', conv: convPct(funnel.demos_attended, funnel.demos_booked) },
        { label: 'Deals Won', value: funnel.deals_won, color: '#059669', conv: convPct(funnel.deals_won, funnel.demos_attended) },
      ]
    : []

  return (
    <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden"
         style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.06)' }}>
      <div className="px-5 py-3 border-b border-[#F1F5F9] flex items-center justify-between">
        <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">Conversion Funnel</p>
        <span className="text-[11px] text-[#94A3B8]">{periodLabel}</span>
      </div>

      {loading || !funnel ? (
        <div className="p-5"><div className="h-16 bg-[#F1F5F9] rounded skeleton" /></div>
      ) : (
        <div className="p-5">
          <div className="flex items-stretch gap-2">
            {stages.map((s, i) => (
              <div key={s.label} className="flex items-stretch gap-2 flex-1">
                <div className="flex-1 rounded-xl border border-[#F1F5F9] bg-[#F8FAFC] px-4 py-3">
                  <p className="text-[22px] font-bold tabular-nums leading-none" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-[11px] text-[#64748B] mt-1.5">{s.label}</p>
                  {s.conv !== null && (
                    <p className="text-[10px] text-[#94A3B8] mt-0.5">{s.conv}% of previous</p>
                  )}
                </div>
                {i < stages.length - 1 && (
                  <div className="flex items-center text-[#CBD5E1]">
                    <ChevronRight className="w-4 h-4" strokeWidth={2} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Lead source breakdown (of assigned leads) + lost/ghosted */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#F1F5F9] flex-wrap gap-2">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Lead Sources</span>
              <span className="text-[11px] text-[#64748B]">Admin Pool <b className="text-[#0F172A] tabular-nums">{funnel.leads_assigned.admin_pool}</b></span>
              <span className="text-[11px] text-[#64748B]">SDR Manual <b className="text-[#0F172A] tabular-nums">{funnel.leads_assigned.sdr_manual}</b></span>
              <span className="text-[11px] text-[#64748B]">SDR Claim <b className="text-[#0F172A] tabular-nums">{funnel.leads_assigned.sdr_claim}</b></span>
            </div>
            <span className="text-[11px] text-[#64748B]">Lost / Ghosted <b className="text-[#EF4444] tabular-nums">{funnel.deals_lost_ghosted}</b></span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export default function AdminDashboardPage() {
  const [period, setPeriod] = useState<Period>('month')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const [sdrs, setSdrs] = useState<SdrStat[]>([])
  const [closers, setClosers] = useState<CloserStat[]>([])
  const [orgKpis, setOrgKpis] = useState<OrgKpis>({ totalLeads: 0, unassignedLeads: 0, totalRevTarget: 0 })
  const [funnel, setFunnel] = useState<FunnelData | null>(null)
  const [loading, setLoading] = useState(true)

  const [selectedSdr, setSelectedSdr] = useState<SdrStat | null>(null)
  const [selectedCloser, setSelectedCloser] = useState<CloserStat | null>(null)

  const supabase = createClient()

  const fetchStats = useCallback(async () => {
    setLoading(true)

    // Build query string
    const params = new URLSearchParams({ period })
    if (period === 'custom' && customStart && customEnd) {
      params.set('start', customStart)
      params.set('end', customEnd)
    }

    const [statsRes, funnelRes, totalLeadsRes, unassignedRes, usersRes] = await Promise.all([
      fetch(`/api/team/stats?${params}`).then(r => r.json()),
      fetch(`/api/admin/funnel?${params}`).then(r => r.json()),
      // Lead KPIs as COUNTS (head:true) — accurate regardless of the ~1000-row fetch cap.
      // Counts active (non-deleted) leads, matching the Lead Pool + export.
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('is_deleted', false),
      // "Unassigned" = no owner (matches the Lead Pool's definition), not the 'new' label —
      // so a still-'new'-labelled but assigned lead never counts as unassigned.
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('is_deleted', false).eq('phase', 'sdr').is('assigned_to', null),
      supabase.from('users')
        .select('id, role, monthly_revenue_target, is_active')
        .eq('is_active', true),
    ])

    setSdrs((statsRes.sdrs ?? []).sort((a: SdrStat, b: SdrStat) => (a.achievement_pct ?? 999) - (b.achievement_pct ?? 999)))
    setClosers((statsRes.closers ?? []).sort((a: CloserStat, b: CloserStat) => (b.revenue_won ?? 0) - (a.revenue_won ?? 0)))
    setFunnel(funnelRes?.leads_assigned ? funnelRes : null)

    const users = usersRes.data ?? []
    const totalLeads = totalLeadsRes.count ?? 0
    const unassignedLeads = unassignedRes.count ?? 0
    const totalRevTarget = users.reduce((s: number, u: { monthly_revenue_target: number | null }) => s + (u.monthly_revenue_target ?? 0), 0)

    setOrgKpis({ totalLeads, unassignedLeads, totalRevTarget })
    setLoading(false)
  }, [period, customStart, customEnd])

  useEffect(() => { fetchStats() }, [fetchStats])

  const totalRevenue = closers.reduce((s, c) => s + (c.revenue_won ?? 0), 0)
  const totalDemosBooked = sdrs.reduce((s, sdr) => s + sdr.demos_booked, 0)
  const totalDemosDone = closers.reduce((s, c) => s + c.demos_done, 0)
  const totalConverted = closers.reduce((s, c) => s + c.converted, 0)
  const overallConvPct = totalDemosDone > 0 ? Math.round((totalConverted / totalDemosDone) * 100) : 0

  const now = new Date()
  const monthLabel = now.toLocaleString('default', { month: 'long' })
  const year = now.getFullYear()

  const subtitleParts = [
    `${monthLabel} ${year}`,
    loading ? 'Loading…' : `${sdrs.length} SDR${sdrs.length !== 1 ? 's' : ''} · ${closers.length} Closer${closers.length !== 1 ? 's' : ''}`,
  ]

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-[#F8FAFC]">
      <TopBar title="Manager Dashboard" subtitle={subtitleParts.join(' · ')} />

      <div className="flex-1 p-6 space-y-6 overflow-y-auto">

        {/* Period filter + export */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <PeriodBar
            period={period}
            onPeriod={setPeriod}
            customStart={customStart}
            customEnd={customEnd}
            onCustomStart={setCustomStart}
            onCustomEnd={setCustomEnd}
          />
          <Link
            href="/api/admin/export"
            className="flex items-center gap-2 px-4 py-2 border border-[#E2E8F0] bg-white text-[#64748B] text-xs font-medium rounded-xl hover:bg-[#F8FAFC] transition-colors"
            style={{ boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}
          >
            ↓ Export Log
          </Link>
        </div>

        {/* Org KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Total Leads" value={orgKpis.totalLeads} subtitle={`${orgKpis.unassignedLeads} unassigned`} accentColor="#1A56DB" />
          <KpiCard label="Demos Booked" value={totalDemosBooked} subtitle={PERIOD_LABELS[period]} accentColor="#7C3AED" />
          <KpiCard label="Revenue Won" value={formatCurrency(totalRevenue)} subtitle={PERIOD_LABELS[period]} accentColor="#059669" />
          <KpiCard label="Revenue Target" value={formatCurrency(orgKpis.totalRevTarget)} subtitle="Team monthly" accentColor="#0891B2" />
        </div>

        {/* ── Conversion Funnel ─────────────────────────────────────────────── */}
        <FunnelStrip funnel={funnel} loading={loading} periodLabel={PERIOD_LABELS[period]} />

        {/* ── SDR Section ───────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-[#EFF6FF] flex items-center justify-center">
                <Users className="w-3.5 h-3.5 text-[#1A56DB]" strokeWidth={2} />
              </div>
              <h2 className="text-[14px] font-semibold text-[#0F172A]">SDR Performance</h2>
            </div>
            {/* Aggregate chips */}
            <div className="flex gap-2">
              <AggChip label="Total Booked" value={totalDemosBooked} accent="#7C3AED" />
              <AggChip label="Total Attended" value={sdrs.reduce((s, r) => s + r.demos_attended, 0)} accent="#1A56DB" />
            </div>
          </div>

          {/* SDR Quality Leaderboard */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden"
               style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.06)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#F1F5F9]">
                  {['SDR', 'Leads', 'Booked', 'Done', 'Not Shown', 'Show-up %', 'Achievement %', 'Status', ''].map((h, i) => (
                    <th key={i} className={cn('px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]', i === 0 ? 'text-left' : 'text-center')}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F8FAFC]">
                {loading ? (
                  [...Array(3)].map((_, i) => (
                    <tr key={i}>
                      {[...Array(8)].map((_, j) => (
                        <td key={j} className="px-4 py-3.5">
                          <div className="h-3 bg-[#F1F5F9] rounded skeleton" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : sdrs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-8 text-center text-[13px] text-[#94A3B8]">No SDR data for this period</td>
                  </tr>
                ) : (
                  sdrs.map(sdr => {
                    const pct = sdr.achievement_pct ?? 0
                    const isPipRisk = pct < 60
                    const isBehind = pct >= 60 && pct < 85
                    return (
                      <tr
                        key={sdr.user_id}
                        className={cn(
                          'hover:bg-[#F8FAFC] transition-colors cursor-pointer',
                          isPipRisk ? 'bg-red-50/40' : ''
                        )}
                        onClick={() => setSelectedSdr(sdr)}
                      >
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-6 h-6 rounded-full bg-[#1A56DB]/10 flex items-center justify-center shrink-0">
                              <span className="text-[#1A56DB] text-[10px] font-bold">{sdr.name.charAt(0)}</span>
                            </div>
                            <span className="font-medium text-[13px] text-[#0F172A]">{sdr.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-center text-[13px] text-[#64748B]">{sdr.leads_assigned}</td>
                        <td className="px-4 py-3.5 text-center font-semibold text-[#0F172A] text-[13px]">{sdr.demos_booked}</td>
                        <td className="px-4 py-3.5 text-center text-[13px] text-[#64748B]">{sdr.demos_attended}</td>
                        <td className="px-4 py-3.5 text-center text-[13px]">
                          <span className={sdr.no_shows > 0 ? 'text-[#EF4444] font-semibold' : 'text-[#94A3B8]'}>
                            {sdr.no_shows}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center text-[13px]">
                          {sdr.show_up_rate !== null ? (
                            <span className={cn('font-semibold', sdr.show_up_rate >= 70 ? 'text-[#059669]' : 'text-[#EF4444]')}>
                              {sdr.show_up_rate}%
                            </span>
                          ) : (
                            <span className="text-[#CBD5E1] text-[11px]">n/a</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-16 h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${Math.min(pct, 100)}%`,
                                  backgroundColor: isPipRisk ? '#EF4444' : isBehind ? '#F59E0B' : '#059669',
                                }}
                              />
                            </div>
                            <span className={cn('text-[12px] font-semibold tabular-nums', isPipRisk ? 'text-[#EF4444]' : isBehind ? 'text-[#F59E0B]' : 'text-[#059669]')}>
                              {pct}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          {isPipRisk ? (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-500 text-white">PIP</span>
                          ) : isBehind ? (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-amber-300 text-amber-700">Behind</span>
                          ) : (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-green-300 text-green-700">On Track</span>
                          )}
                        </td>
                        <td className="px-3 py-3.5">
                          <ChevronRight className="w-3.5 h-3.5 text-[#CBD5E1]" strokeWidth={2} />
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Closer Section ────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-[#F0FDF4] flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5 text-[#059669]" strokeWidth={2} />
              </div>
              <h2 className="text-[14px] font-semibold text-[#0F172A]">Closer Performance</h2>
            </div>
            <div className="flex gap-2">
              <AggChip label="Total Revenue" value={formatCurrency(totalRevenue)} accent="#059669" />
              <AggChip label="Demos Done" value={totalDemosDone} accent="#1A56DB" />
              <AggChip label="Conv. Rate" value={`${overallConvPct}%`} accent={overallConvPct >= 12 ? '#059669' : '#F59E0B'} />
            </div>
          </div>

          {/* Closer performance table */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden"
               style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.06)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#F1F5F9]">
                  {['Closer', 'Demos Done', 'Converted', 'Conv. %', 'ASP', 'In Pipeline', 'Achievement %', ''].map((h, i) => (
                    <th key={i} className={cn('px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]', i === 0 ? 'text-left' : 'text-center')}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F8FAFC]">
                {loading ? (
                  [...Array(2)].map((_, i) => (
                    <tr key={i}>
                      {[...Array(8)].map((_, j) => (
                        <td key={j} className="px-4 py-3.5">
                          <div className="h-3 bg-[#F1F5F9] rounded skeleton" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : closers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-8 text-center text-[13px] text-[#94A3B8]">No Closer data for this period</td>
                  </tr>
                ) : (
                  closers.map(closer => {
                    const pct = closer.achievement_pct ?? 0
                    const isPipRisk = pct < 60
                    const isBehind = pct >= 60 && pct < 85
                    return (
                      <tr
                        key={closer.user_id}
                        className="hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                        onClick={() => setSelectedCloser(closer)}
                      >
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-6 h-6 rounded-full bg-[#059669]/10 flex items-center justify-center shrink-0">
                              <span className="text-[#059669] text-[10px] font-bold">{closer.name.charAt(0)}</span>
                            </div>
                            <span className="font-medium text-[13px] text-[#0F172A]">{closer.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-center text-[13px] text-[#64748B]">{closer.demos_done}</td>
                        <td className="px-4 py-3.5 text-center font-semibold text-[#059669] text-[13px]">{closer.converted}</td>
                        <td className="px-4 py-3.5 text-center text-[13px]">
                          {closer.conversion_pct !== null ? (
                            <span className={cn('font-semibold', (closer.conversion_pct ?? 0) >= 12 ? 'text-[#059669]' : 'text-[#F59E0B]')}>
                              {closer.conversion_pct}%
                            </span>
                          ) : <span className="text-[#CBD5E1]">—</span>}
                        </td>
                        <td className="px-4 py-3.5 text-center text-[13px] text-[#64748B]">
                          {closer.asp !== null ? formatCurrency(closer.asp) : '—'}
                        </td>
                        <td className="px-4 py-3.5 text-center text-[13px] text-[#64748B]">{closer.in_pipeline}</td>
                        <td className="px-4 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-16 h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${Math.min(pct, 100)}%`,
                                  backgroundColor: isPipRisk ? '#EF4444' : isBehind ? '#F59E0B' : '#059669',
                                }}
                              />
                            </div>
                            <span className={cn('text-[12px] font-semibold tabular-nums', isPipRisk ? 'text-[#EF4444]' : isBehind ? 'text-[#F59E0B]' : 'text-[#059669]')}>
                              {pct}%
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3.5">
                          <ChevronRight className="w-3.5 h-3.5 text-[#CBD5E1]" strokeWidth={2} />
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Revenue contribution table */}
          {!loading && closers.length > 0 && totalRevenue > 0 && (
            <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden"
                 style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.06)' }}>
              <div className="px-5 py-3 border-b border-[#F1F5F9]">
                <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">Revenue Contribution</p>
              </div>
              <div className="divide-y divide-[#F8FAFC]">
                {closers.map(closer => {
                  const contribution = totalRevenue > 0 ? Math.round((closer.revenue_won / totalRevenue) * 100) : 0
                  return (
                    <div key={closer.user_id} className="flex items-center gap-4 px-5 py-3">
                      <span className="text-[12px] font-medium text-[#0F172A] w-28 truncate shrink-0">{closer.name}</span>
                      <span className="text-[13px] font-semibold text-[#0F172A] tabular-nums w-24 shrink-0">{formatCurrency(closer.revenue_won)}</span>
                      <span className="text-[11px] text-[#94A3B8] w-10 shrink-0 text-right">{contribution}%</span>
                      <div className="flex-1 h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#059669] transition-all duration-500"
                          style={{ width: `${contribution}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Payout Summary */}
        <PayoutSummary />

      </div>

      {/* Slide-in panels */}
      {selectedSdr && <SdrPanel sdr={selectedSdr} onClose={() => setSelectedSdr(null)} />}
      {selectedCloser && <CloserPanel closer={selectedCloser} totalRevenue={totalRevenue} onClose={() => setSelectedCloser(null)} />}
    </div>
  )
}
