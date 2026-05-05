'use client'

import { useState, useEffect, useCallback } from 'react'
import TopBar from '@/components/layout/TopBar'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { UserPlus, Edit2, Check, X, AlertCircle, TrendingUp, ChevronRight, CalendarDays } from 'lucide-react'

// ── Team Management types ──────────────────────────────────────────────────────
type TeamUser = {
  id: string
  name: string
  email: string
  role: string
  phone: string | null
  monthly_demo_target: number | null
  monthly_revenue_target: number | null
  monthly_base_salary: number | null
  is_active: boolean | null
  created_at: string | null
}

type UserPerf = {
  user_id: string
  role: string
  demos_this_month: number
  revenue_this_month: number
  achievement_pct: number
  multiplier: number
  est_incentive: number
  base_salary: number
  total_payout: number
}

// ── Stats types ────────────────────────────────────────────────────────────────
interface SdrStat {
  user_id: string
  name: string
  role: 'sdr'
  pip_status: string | null
  monthly_demo_target: number | null
  demos_booked: number
  demos_attended: number
  leads_reached_out: number
  cold_call_to_demo_pct: number | null
  no_shows: number
  show_up_rate: number | null
  unqualified: number
  already_converted: number
  achievement_pct: number | null
}

interface CloserStat {
  user_id: string
  name: string
  role: 'closer'
  pip_status: string | null
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

type Period = 'today' | 'week' | 'month' | 'all' | 'custom'

const PERIOD_LABELS: Record<Period, string> = {
  today: 'Today', week: 'This Week', month: 'This Month', all: 'All Time', custom: 'Custom',
}

const ROLE_BADGES: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700',
  sdr: 'bg-blue-100 text-blue-700',
  closer: 'bg-green-100 text-green-700',
  sales_ops: 'bg-slate-100 text-slate-600',
}

// ── Shared StatRow ─────────────────────────────────────────────────────────────
function StatRow({ label, value, valueClass }: { label: string; value: string | number; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <p className="text-[12px] text-[#64748B]">{label}</p>
      <p className={cn('text-[13px] font-semibold text-[#0F172A] tabular-nums', valueClass)}>{value}</p>
    </div>
  )
}

// ── Period Bar ─────────────────────────────────────────────────────────────────
function PeriodBar({
  period, onPeriod, customStart, customEnd, onCustomStart, onCustomEnd,
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
    if (p === 'custom') { setShowCustom(true) }
    else { setShowCustom(false); onPeriod(p) }
  }

  function applyCustom() {
    if (customStart && customEnd) { onPeriod('custom'); setShowCustom(false) }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center bg-white border border-[#E2E8F0] rounded-xl p-1 gap-0.5"
           style={{ boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}>
        {(['today', 'week', 'month', 'all'] as Period[]).map(p => (
          <button key={p} onClick={() => selectPeriod(p)}
            className={cn('px-3.5 py-1.5 rounded-lg text-[12px] font-medium transition-all',
              period === p ? 'bg-[#1A56DB] text-white shadow-sm' : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]')}>
            {PERIOD_LABELS[p]}
          </button>
        ))}
        <button onClick={() => selectPeriod('custom')}
          className={cn('flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-medium transition-all',
            period === 'custom' ? 'bg-[#1A56DB] text-white shadow-sm' : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]')}>
          <CalendarDays className="w-3 h-3" strokeWidth={2} />
          {period === 'custom' && customStart && customEnd ? `${customStart} → ${customEnd}` : 'Custom Range'}
        </button>
      </div>
      {showCustom && (
        <div className="flex items-center gap-2 bg-white border border-[#E2E8F0] rounded-xl px-3 py-2"
             style={{ boxShadow: '0 4px 12px rgba(15,23,42,0.08)' }}>
          <label className="text-[11px] text-[#94A3B8] font-medium">From</label>
          <input type="date" value={customStart} onChange={e => onCustomStart(e.target.value)}
            className="text-[12px] border border-[#E2E8F0] rounded-lg px-2 py-1 focus:outline-none focus:border-[#1A56DB]" />
          <label className="text-[11px] text-[#94A3B8] font-medium">To</label>
          <input type="date" value={customEnd} onChange={e => onCustomEnd(e.target.value)}
            className="text-[12px] border border-[#E2E8F0] rounded-lg px-2 py-1 focus:outline-none focus:border-[#1A56DB]" />
          <button onClick={applyCustom} disabled={!customStart || !customEnd}
            className="px-3 py-1.5 bg-[#1A56DB] text-white text-[11px] font-semibold rounded-lg disabled:opacity-40 hover:bg-[#1A3DB5] transition-colors">
            Apply
          </button>
          <button onClick={() => setShowCustom(false)} className="p-1 text-[#94A3B8] hover:text-[#374151] transition-colors">
            <X className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
        </div>
      )}
    </div>
  )
}

// ── SDR Detail Panel ───────────────────────────────────────────────────────────
function SdrDetailPanel({ sdr, onClose }: { sdr: SdrStat; onClose: () => void }) {
  const pct = sdr.achievement_pct ?? 0
  const isPipRisk = pct < 60
  const isBehind = pct >= 60 && pct < 85
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
                <p className="text-[11px] text-[#94A3B8]">SDR · {sdr.monthly_demo_target ?? '—'} demo target</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1">
              {isPipRisk
                ? <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-500 text-white">PIP RISK</span>
                : isBehind
                ? <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-amber-300 text-amber-700">Behind</span>
                : <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-green-300 text-green-700">On Track</span>
              }
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
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 bg-[#EFF6FF] rounded-xl">
              <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider mb-1">Demos Booked</p>
              <p className="text-[24px] font-bold text-[#1A56DB] leading-none">{sdr.demos_booked}</p>
            </div>
            <div className="p-4 bg-[#F0FDF4] rounded-xl">
              <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider mb-1">Achievement</p>
              <p className={cn('text-[24px] font-bold leading-none', isPipRisk ? 'text-[#EF4444]' : isBehind ? 'text-[#F59E0B]' : 'text-[#059669]')}>
                {sdr.achievement_pct !== null ? `${sdr.achievement_pct}%` : '—'}
              </p>
            </div>
          </div>
          <div className="bg-[#F8FAFC] rounded-xl border border-[#F1F5F9] overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[#F1F5F9]">
              <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">Outreach</p>
            </div>
            <div className="divide-y divide-[#F1F5F9]">
              <StatRow label="Leads Reached Out" value={sdr.leads_reached_out} />
              <StatRow label="Cold Call → Demo %" value={sdr.cold_call_to_demo_pct !== null ? `${sdr.cold_call_to_demo_pct}%` : '—'} />
            </div>
          </div>
          <div className="bg-[#F8FAFC] rounded-xl border border-[#F1F5F9] overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[#F1F5F9]">
              <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">Demo Quality</p>
            </div>
            <div className="divide-y divide-[#F1F5F9]">
              <StatRow label="Show-up Rate" value={sdr.show_up_rate !== null ? `${sdr.show_up_rate}%` : '< 3 demos'}
                valueClass={sdr.show_up_rate !== null ? (sdr.show_up_rate >= 70 ? 'text-[#059669]' : 'text-[#EF4444]') : 'text-[#94A3B8]'} />
              <StatRow label="No-Shows" value={sdr.no_shows} />
              <StatRow label="Unqualified (by Closer)" value={sdr.unqualified} />
              <StatRow label="Already Converted" value={sdr.already_converted} valueClass="text-[#059669]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Closer Detail Panel ────────────────────────────────────────────────────────
function CloserDetailPanel({ closer, totalRevenue, onClose }: { closer: CloserStat; totalRevenue: number; onClose: () => void }) {
  const pct = closer.achievement_pct ?? 0
  const isPipRisk = pct < 60
  const isBehind = pct >= 60 && pct < 85
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
                <p className="text-[11px] text-[#94A3B8]">Closer · {closer.monthly_revenue_target ? formatCurrency(closer.monthly_revenue_target) : '—'} target</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1">
              {isPipRisk
                ? <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-500 text-white">PIP RISK</span>
                : isBehind
                ? <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-amber-300 text-amber-700">Behind</span>
                : <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-green-300 text-green-700">On Track</span>
              }
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
            </div>
          </div>
          <div className="bg-[#F8FAFC] rounded-xl border border-[#F1F5F9] overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[#F1F5F9]">
              <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">Demo Performance</p>
            </div>
            <div className="divide-y divide-[#F1F5F9]">
              <StatRow label="Demos Done" value={closer.demos_done} />
              <StatRow label="Converted (Won)" value={closer.converted} valueClass="text-[#059669]" />
              <StatRow label="Conversion %" value={closer.conversion_pct !== null ? `${closer.conversion_pct}%` : '—'}
                valueClass={(closer.conversion_pct ?? 0) >= 12 ? 'text-[#059669]' : 'text-[#F59E0B]'} />
              <StatRow label="Avg Deal Cycle" value={closer.avg_deal_cycle !== null ? `${closer.avg_deal_cycle}d` : '—'} />
            </div>
          </div>
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

// ── Statistics Tab Content ─────────────────────────────────────────────────────
function StatisticsTab() {
  const [period, setPeriod] = useState<Period>('month')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [sdrs, setSdrs] = useState<SdrStat[]>([])
  const [closers, setClosers] = useState<CloserStat[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSdr, setSelectedSdr] = useState<SdrStat | null>(null)
  const [selectedCloser, setSelectedCloser] = useState<CloserStat | null>(null)

  const fetchStats = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ period })
    if (period === 'custom' && customStart && customEnd) {
      params.set('start', customStart)
      params.set('end', customEnd)
    }
    const res = await fetch(`/api/team/stats?${params}`).then(r => r.json())
    setSdrs((res.sdrs ?? []).sort((a: SdrStat, b: SdrStat) => (a.achievement_pct ?? 999) - (b.achievement_pct ?? 999)))
    setClosers((res.closers ?? []).sort((a: CloserStat, b: CloserStat) => (b.revenue_won ?? 0) - (a.revenue_won ?? 0)))
    setLoading(false)
  }, [period, customStart, customEnd])

  useEffect(() => { fetchStats() }, [fetchStats])

  const totalRevenue = closers.reduce((s, c) => s + (c.revenue_won ?? 0), 0)

  function AchBar({ pct }: { pct: number | null }) {
    const p = pct ?? 0
    const isPip = p < 60
    const isBehind = p >= 60 && p < 85
    return (
      <div className="flex items-center gap-1.5">
        <div className="w-14 h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${Math.min(p, 100)}%`, backgroundColor: isPip ? '#EF4444' : isBehind ? '#F59E0B' : '#059669' }} />
        </div>
        <span className={cn('text-[11px] font-semibold tabular-nums', isPip ? 'text-[#EF4444]' : isBehind ? 'text-[#F59E0B]' : 'text-[#059669]')}>
          {pct !== null ? `${p}%` : '—'}
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PeriodBar period={period} onPeriod={setPeriod} customStart={customStart} customEnd={customEnd}
        onCustomStart={setCustomStart} onCustomEnd={setCustomEnd} />

      {/* SDR Stats */}
      <div>
        <h3 className="text-[12px] font-semibold text-[#64748B] uppercase tracking-wider mb-2.5">SDR · {PERIOD_LABELS[period]}</h3>
        <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden"
             style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.06)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#F1F5F9]">
                {['SDR', 'Demos Booked', 'Done', 'No-Shows', 'Show-up %', 'Cold→Demo %', 'Achievement', ''].map((h, i) => (
                  <th key={i} className={cn('px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]', i === 0 ? 'text-left' : 'text-center')}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F8FAFC]">
              {loading ? (
                [...Array(2)].map((_, i) => (
                  <tr key={i}>{[...Array(8)].map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-3 bg-[#F1F5F9] rounded skeleton" /></td>
                  ))}</tr>
                ))
              ) : sdrs.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-6 text-center text-[13px] text-[#94A3B8]">No SDR data for this period</td></tr>
              ) : sdrs.map(sdr => {
                const pct = sdr.achievement_pct ?? 0
                const isPip = pct < 60
                return (
                  <tr key={sdr.user_id} className={cn('hover:bg-[#F8FAFC] transition-colors cursor-pointer', isPip ? 'bg-red-50/30' : '')}
                      onClick={() => setSelectedSdr(sdr)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-[#1A56DB]/10 flex items-center justify-center shrink-0">
                          <span className="text-[#1A56DB] text-[10px] font-bold">{sdr.name.charAt(0)}</span>
                        </div>
                        <span className="font-medium text-[12px] text-[#0F172A]">{sdr.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-[12px] text-[#0F172A]">{sdr.demos_booked}</td>
                    <td className="px-4 py-3 text-center text-[12px] text-[#64748B]">{sdr.demos_attended}</td>
                    <td className="px-4 py-3 text-center text-[12px]">
                      <span className={sdr.no_shows > 0 ? 'text-[#EF4444] font-semibold' : 'text-[#94A3B8]'}>{sdr.no_shows}</span>
                    </td>
                    <td className="px-4 py-3 text-center text-[12px]">
                      {sdr.show_up_rate !== null
                        ? <span className={cn('font-semibold', sdr.show_up_rate >= 70 ? 'text-[#059669]' : 'text-[#EF4444]')}>{sdr.show_up_rate}%</span>
                        : <span className="text-[#CBD5E1] text-[10px]">n/a</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-center text-[12px] text-[#64748B]">
                      {sdr.cold_call_to_demo_pct !== null ? `${sdr.cold_call_to_demo_pct}%` : '—'}
                    </td>
                    <td className="px-4 py-3"><AchBar pct={sdr.achievement_pct} /></td>
                    <td className="px-3 py-3"><ChevronRight className="w-3.5 h-3.5 text-[#CBD5E1]" strokeWidth={2} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Closer Stats */}
      <div>
        <h3 className="text-[12px] font-semibold text-[#64748B] uppercase tracking-wider mb-2.5">Closers · {PERIOD_LABELS[period]}</h3>
        <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden"
             style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.06)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#F1F5F9]">
                {['Closer', 'Demos Done', 'Converted', 'Conv. %', 'ASP', 'Pipeline', 'Achievement', ''].map((h, i) => (
                  <th key={i} className={cn('px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]', i === 0 ? 'text-left' : 'text-center')}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F8FAFC]">
              {loading ? (
                [...Array(2)].map((_, i) => (
                  <tr key={i}>{[...Array(8)].map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-3 bg-[#F1F5F9] rounded skeleton" /></td>
                  ))}</tr>
                ))
              ) : closers.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-6 text-center text-[13px] text-[#94A3B8]">No Closer data for this period</td></tr>
              ) : closers.map(closer => (
                <tr key={closer.user_id} className="hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                    onClick={() => setSelectedCloser(closer)}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[#059669]/10 flex items-center justify-center shrink-0">
                        <span className="text-[#059669] text-[10px] font-bold">{closer.name.charAt(0)}</span>
                      </div>
                      <span className="font-medium text-[12px] text-[#0F172A]">{closer.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center text-[12px] text-[#64748B]">{closer.demos_done}</td>
                  <td className="px-4 py-3 text-center font-semibold text-[12px] text-[#059669]">{closer.converted}</td>
                  <td className="px-4 py-3 text-center text-[12px]">
                    {closer.conversion_pct !== null
                      ? <span className={cn('font-semibold', (closer.conversion_pct ?? 0) >= 12 ? 'text-[#059669]' : 'text-[#F59E0B]')}>{closer.conversion_pct}%</span>
                      : <span className="text-[#CBD5E1]">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center text-[12px] text-[#64748B]">{closer.asp !== null ? formatCurrency(closer.asp) : '—'}</td>
                  <td className="px-4 py-3 text-center text-[12px] text-[#64748B]">{closer.in_pipeline}</td>
                  <td className="px-4 py-3"><AchBar pct={closer.achievement_pct} /></td>
                  <td className="px-3 py-3"><ChevronRight className="w-3.5 h-3.5 text-[#CBD5E1]" strokeWidth={2} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedSdr && <SdrDetailPanel sdr={selectedSdr} onClose={() => setSelectedSdr(null)} />}
      {selectedCloser && <CloserDetailPanel closer={selectedCloser} totalRevenue={totalRevenue} onClose={() => setSelectedCloser(null)} />}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function TeamPage() {
  const [activeTab, setActiveTab] = useState<'management' | 'stats'>('management')

  // Management tab state
  const [users, setUsers] = useState<TeamUser[]>([])
  const [perf, setPerf] = useState<Record<string, UserPerf>>({})
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Partial<TeamUser>>({})
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState('sdr')
  const [showInvite, setShowInvite] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const [usersRes, perfRes] = await Promise.all([
      supabase
        .from('users')
        .select('id, name, email, role, phone, monthly_demo_target, monthly_revenue_target, monthly_base_salary, is_active, created_at')
        .order('created_at', { ascending: true }),
      fetch('/api/team/performance').then(r => r.json()),
    ])
    setUsers((usersRes.data as TeamUser[]) ?? [])
    const perfMap: Record<string, UserPerf> = {}
    ;((perfRes as UserPerf[]) ?? []).forEach(p => { perfMap[p.user_id] = p })
    setPerf(perfMap)
    setLoading(false)
  }

  function startEdit(user: TeamUser) {
    setEditingId(user.id)
    setEditValues({
      name: user.name,
      role: user.role,
      phone: user.phone ?? '',
      monthly_demo_target: user.monthly_demo_target ?? 0,
      monthly_revenue_target: user.monthly_revenue_target ?? 0,
      monthly_base_salary: user.monthly_base_salary ?? 0,
      is_active: user.is_active ?? true,
    })
  }

  async function saveEdit(userId: string) {
    setSaving(true)
    setError(null)
    const res = await fetch(`/api/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editValues),
    })
    if (res.ok) {
      await loadAll()
      setEditingId(null)
      setSuccessMsg('Changes saved.')
      setTimeout(() => setSuccessMsg(null), 3000)
    } else {
      const data = await res.json()
      setError(data.error ?? 'Failed to save')
    }
    setSaving(false)
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail, name: inviteName, role: inviteRole }),
    })
    if (res.ok) {
      setShowInvite(false)
      setInviteEmail('')
      setInviteName('')
      await loadAll()
      setSuccessMsg('Invite sent! They will receive a magic link to set their password.')
      setTimeout(() => setSuccessMsg(null), 5000)
    } else {
      const data = await res.json()
      setError(data.error ?? 'Failed to invite')
    }
    setSaving(false)
  }

  const needsSetup = users.filter(u =>
    (u.role === 'sdr' || u.role === 'closer') &&
    (u.monthly_demo_target === null || u.monthly_revenue_target === null)
  )

  const perfValues = Object.values(perf)
  const totalBaseSalary = perfValues.reduce((s, p) => s + p.base_salary, 0)
  const totalIncentive = perfValues.reduce((s, p) => s + p.est_incentive, 0)
  const totalPayout = totalBaseSalary + totalIncentive

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-[#1A56DB] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="flex-1 flex flex-col bg-[#F8FAFC]">
      <TopBar title="Team" subtitle="Management & Statistics" />

      <div className="flex-1 p-6 space-y-5 overflow-y-auto">

        {/* Tab switcher */}
        <div className="flex items-center bg-white border border-[#E2E8F0] rounded-xl p-1 gap-0.5 w-fit"
             style={{ boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}>
          {(['management', 'stats'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-5 py-2 rounded-lg text-[13px] font-medium transition-all',
                activeTab === tab
                  ? 'bg-[#1A56DB] text-white shadow-sm'
                  : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
              )}
            >
              {tab === 'management' ? 'Team Management' : 'Team Statistics'}
            </button>
          ))}
        </div>

        {/* ── MANAGEMENT TAB ─────────────────────────────────────────────── */}
        {activeTab === 'management' && (
          <>
            {/* Alert: members needing target setup */}
            {needsSetup.length > 0 && (
              <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800">
                    {needsSetup.length} member{needsSetup.length > 1 ? 's' : ''} need targets assigned
                  </p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    {needsSetup.map(u => u.name).join(', ')} — click the edit icon to set their demo and revenue targets.
                  </p>
                </div>
              </div>
            )}

            {/* Payout summary banner */}
            {perfValues.length > 0 && (
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Total Base Salary', value: formatCurrency(totalBaseSalary), color: '#1A56DB' },
                  { label: 'Est. Incentives This Month', value: formatCurrency(totalIncentive), color: '#7C3AED' },
                  { label: 'Est. Total Payout', value: formatCurrency(totalPayout), color: '#059669' },
                ].map(item => (
                  <div key={item.label} className="bg-white rounded-xl border border-[#E2E8F0] px-5 py-4 shadow-sm">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8]">{item.label}</p>
                    <p className="text-xl font-bold mt-1" style={{ color: item.color }}>{item.value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Header row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <p className="text-sm text-[#64748B]">{users.filter(u => u.is_active).length} active members</p>
                <span className="text-xs text-[#94A3B8]">· Incentive: SDR ₹500/demo · Closer 7% of revenue · multiplied by achievement tier</span>
              </div>
              <button
                onClick={() => setShowInvite(true)}
                className="flex items-center gap-2 px-4 py-2 bg-[#1A56DB] text-white text-sm font-medium rounded-lg hover:bg-[#1A4FBF] transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                Invite Member
              </button>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600 flex items-center justify-between">
                {error}
                <button onClick={() => setError(null)}><X className="w-3.5 h-3.5" /></button>
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-green-50 border border-green-100 rounded-lg text-sm text-green-700">
                {successMsg}
              </div>
            )}

            {/* Invite form */}
            {showInvite && (
              <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-[#0F172A] mb-1">Invite New Member</h3>
                <p className="text-xs text-[#64748B] mb-4">They will receive a magic link to set their password. You can set their targets after they join.</p>
                <form onSubmit={handleInvite} className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#64748B] mb-1">Full Name</label>
                    <input value={inviteName} onChange={e => setInviteName(e.target.value)} required
                      className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20 focus:border-[#1A56DB]"
                      placeholder="Ravi Kumar" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#64748B] mb-1">Email</label>
                    <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} required
                      className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20 focus:border-[#1A56DB]"
                      placeholder="ravi@daanveda.com" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#64748B] mb-1">Role</label>
                    <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20">
                      <option value="sdr">SDR</option>
                      <option value="closer">Closer</option>
                      <option value="admin">Admin</option>
                      <option value="sales_ops">Sales Ops</option>
                    </select>
                  </div>
                  <div className="flex items-end gap-2">
                    <button type="submit" disabled={saving}
                      className="flex-1 py-2 bg-[#1A56DB] text-white text-sm font-medium rounded-lg hover:bg-[#1A4FBF] disabled:opacity-60 transition-colors">
                      {saving ? 'Sending...' : 'Send Invite'}
                    </button>
                    <button type="button" onClick={() => setShowInvite(false)}
                      className="py-2 px-3 text-sm border border-[#E2E8F0] text-[#64748B] rounded-lg hover:bg-[#F8FAFC]">
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Team table */}
            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-x-auto">
              <table className="w-full text-sm min-w-[1100px]">
                <thead>
                  <tr className="bg-[#F1F5F9]">
                    <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Member</th>
                    <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Role</th>
                    <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Demo Target</th>
                    <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Rev Target</th>
                    <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Base Salary</th>
                    <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Achievement</th>
                    <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Est. Incentive</th>
                    <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Total Payout</th>
                    <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Status</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {users.map(user => {
                    const needsTarget = (user.role === 'sdr' || user.role === 'closer') &&
                      (user.monthly_demo_target === null || user.monthly_revenue_target === null)
                    const p = perf[user.id]
                    const isEditing = editingId === user.id

                    return (
                      <tr key={user.id} className={`hover:bg-[#F8FAFC] transition-colors ${needsTarget ? 'bg-amber-50/40' : ''}`}>
                        {/* Member */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#1A56DB]/10 flex items-center justify-center flex-shrink-0">
                              <span className="text-[#1A56DB] text-xs font-semibold">{user.name.charAt(0).toUpperCase()}</span>
                            </div>
                            <div>
                              {isEditing ? (
                                <input value={editValues.name ?? ''} onChange={e => setEditValues(v => ({ ...v, name: e.target.value }))}
                                  className="px-2 py-1 text-sm border border-[#1A56DB] rounded focus:outline-none w-36" />
                              ) : (
                                <p className="font-medium text-[#0F172A]">{user.name}</p>
                              )}
                              <p className="text-xs text-[#94A3B8]">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        {/* Role */}
                        <td className="px-5 py-3.5">
                          {isEditing ? (
                            <select value={editValues.role ?? user.role} onChange={e => setEditValues(v => ({ ...v, role: e.target.value }))}
                              className="px-2 py-1 text-sm border border-[#1A56DB] rounded focus:outline-none">
                              <option value="sdr">SDR</option>
                              <option value="closer">Closer</option>
                              <option value="admin">Admin</option>
                              <option value="sales_ops">Sales Ops</option>
                            </select>
                          ) : (
                            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGES[user.role] ?? 'bg-slate-100 text-slate-600'}`}>
                              {user.role.toUpperCase()}
                            </span>
                          )}
                        </td>
                        {/* Demo Target */}
                        <td className="px-5 py-3.5">
                          {isEditing ? (
                            <input type="number" min="0" value={editValues.monthly_demo_target ?? 0}
                              onChange={e => setEditValues(v => ({ ...v, monthly_demo_target: Number(e.target.value) }))}
                              className="px-2 py-1 text-sm border border-[#1A56DB] rounded focus:outline-none w-20" />
                          ) : user.monthly_demo_target !== null ? (
                            <span className="text-[#0F172A]">{user.monthly_demo_target} demos</span>
                          ) : (
                            <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> Not set
                            </span>
                          )}
                        </td>
                        {/* Revenue Target */}
                        <td className="px-5 py-3.5">
                          {isEditing ? (
                            <input type="number" min="0" value={editValues.monthly_revenue_target ?? 0}
                              onChange={e => setEditValues(v => ({ ...v, monthly_revenue_target: Number(e.target.value) }))}
                              className="px-2 py-1 text-sm border border-[#1A56DB] rounded focus:outline-none w-28" />
                          ) : user.monthly_revenue_target !== null ? (
                            <span className="text-[#0F172A]">{formatCurrency(user.monthly_revenue_target)}</span>
                          ) : (
                            <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> Not set
                            </span>
                          )}
                        </td>
                        {/* Base Salary */}
                        <td className="px-5 py-3.5">
                          {isEditing ? (
                            <input type="number" min="0" value={editValues.monthly_base_salary ?? 0}
                              onChange={e => setEditValues(v => ({ ...v, monthly_base_salary: Number(e.target.value) }))}
                              className="px-2 py-1 text-sm border border-[#1A56DB] rounded focus:outline-none w-28"
                              placeholder="₹ per month" />
                          ) : user.monthly_base_salary ? (
                            <span className="text-[#0F172A] font-medium">{formatCurrency(user.monthly_base_salary)}</span>
                          ) : (
                            <span className="text-xs text-[#94A3B8]">—</span>
                          )}
                        </td>
                        {/* Achievement */}
                        <td className="px-5 py-3.5">
                          {p ? (
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                                <div className="h-full rounded-full"
                                  style={{
                                    width: `${Math.min(p.achievement_pct, 100)}%`,
                                    backgroundColor: p.achievement_pct < 70 ? '#EF4444' : p.achievement_pct < 100 ? '#F59E0B' : '#059669',
                                  }} />
                              </div>
                              <span className={`text-xs font-semibold ${p.achievement_pct < 70 ? 'text-red-500' : p.achievement_pct < 100 ? 'text-amber-500' : 'text-green-600'}`}>
                                {p.achievement_pct}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-[#94A3B8]">—</span>
                          )}
                        </td>
                        {/* Est. Incentive */}
                        <td className="px-5 py-3.5">
                          {p ? (
                            <div>
                              <span className="font-medium text-[#7C3AED]">{formatCurrency(p.est_incentive)}</span>
                              {p.multiplier > 0 && <span className="ml-1 text-[10px] text-[#94A3B8]">{p.multiplier}×</span>}
                              {p.multiplier === 0 && <span className="ml-1 text-[10px] text-red-400">locked</span>}
                            </div>
                          ) : (
                            <span className="text-xs text-[#94A3B8]">—</span>
                          )}
                        </td>
                        {/* Total Payout */}
                        <td className="px-5 py-3.5">
                          {p && (p.base_salary > 0 || p.est_incentive > 0) ? (
                            <span className="font-semibold text-[#059669]">{formatCurrency(p.total_payout)}</span>
                          ) : (
                            <span className="text-xs text-[#94A3B8]">—</span>
                          )}
                        </td>
                        {/* Status */}
                        <td className="px-5 py-3.5">
                          {isEditing ? (
                            <select value={String(editValues.is_active)} onChange={e => setEditValues(v => ({ ...v, is_active: e.target.value === 'true' }))}
                              className="px-2 py-1 text-sm border border-[#1A56DB] rounded focus:outline-none">
                              <option value="true">Active</option>
                              <option value="false">Inactive</option>
                            </select>
                          ) : (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${user.is_active ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-500'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${user.is_active ? 'bg-green-500' : 'bg-slate-400'}`} />
                              {user.is_active ? 'Active' : 'Inactive'}
                            </span>
                          )}
                        </td>
                        {/* Edit */}
                        <td className="px-5 py-3.5">
                          {isEditing ? (
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => saveEdit(user.id)} disabled={saving}
                                className="p-1.5 bg-[#059669] text-white rounded hover:bg-[#047857] disabled:opacity-60 transition-colors" title="Save">
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => setEditingId(null)}
                                className="p-1.5 bg-slate-100 text-[#64748B] rounded hover:bg-slate-200 transition-colors" title="Cancel">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => startEdit(user)}
                              className={`p-1.5 rounded transition-colors ${needsTarget ? 'text-amber-500 hover:text-amber-700 hover:bg-amber-100' : 'text-[#64748B] hover:text-[#1A56DB] hover:bg-[#F8FAFC]'}`}
                              title="Edit member">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {users.length === 0 && (
                <div className="text-center py-12 text-[#64748B] text-sm">
                  No team members yet. Invite your first SDR or Closer above.
                </div>
              )}
            </div>

            {/* Incentive formula note */}
            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg">
              <TrendingUp className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-700">
                <span className="font-semibold">Incentive formula:</span> SDR = ₹500 × demos booked × tier multiplier · Closer = 7% of revenue closed × tier multiplier ·
                Tier multipliers: &lt;70% = 0× · 70–99% = 1× · 100–119% = 1.25× · 120%+ = 1.5×
              </p>
            </div>
          </>
        )}

        {/* ── STATISTICS TAB ─────────────────────────────────────────────── */}
        {activeTab === 'stats' && <StatisticsTab />}

      </div>
    </div>
  )
}
