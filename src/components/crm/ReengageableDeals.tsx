'use client'

import { useState } from 'react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { RotateCcw, MapPin } from 'lucide-react'

interface Row {
  id: string
  name: string
  location: string | null
  date: string | null
  value: number | null
}

// Re-engageable Deal History sections — Converting Later + Ghosted.
// "Bring back" returns the deal to the closer's active Kanban at the Follow-up
// stage (preserving all data), with next_follow_up set so the cycle resumes.
export default function ReengageableDeals({ convertingLater, ghosted }: { convertingLater: Row[]; ghosted: Row[] }) {
  const [cl, setCl] = useState(convertingLater)
  const [gh, setGh] = useState(ghosted)
  const [ghDates, setGhDates] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)

  async function bringBack(id: string, nextFollowUp: string | null, from: 'cl' | 'gh') {
    setBusy(id)
    const res = await fetch(`/api/deals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: 'follow_up', removed_from_board: false, next_follow_up: nextFollowUp || null }),
    })
    if (res.ok) {
      if (from === 'cl') setCl(prev => prev.filter(r => r.id !== id))
      else setGh(prev => prev.filter(r => r.id !== id))
    } else {
      alert('Failed to bring back. Please try again.')
    }
    setBusy(null)
  }

  if (cl.length === 0 && gh.length === 0) return null

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Converting Later */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.06)' }}>
        <div className="px-5 py-4 border-b border-[#F1F5F9] flex items-center justify-between">
          <div>
            <p className="text-[13px] font-semibold text-[#0F172A]">Converting Later ({cl.length})</p>
            <p className="text-[11px] text-[#94A3B8]">Committed to convert on a future date · soonest first</p>
          </div>
          <span className="w-2.5 h-2.5 rounded-full bg-[#0D9488]" />
        </div>
        <div className="divide-y divide-[#F1F5F9] max-h-[420px] overflow-y-auto">
          {cl.length === 0 ? (
            <p className="px-5 py-6 text-center text-[12px] text-[#94A3B8]">None right now.</p>
          ) : cl.map(r => (
            <div key={r.id} className="px-5 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-[#0F172A] truncate">{r.name}</p>
                <div className="flex flex-wrap items-center gap-x-3 text-[11px] text-[#94A3B8]">
                  {r.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{r.location}</span>}
                  <span className="font-medium text-[#0F766E]">Convert by {formatDate(r.date)}</span>
                  {r.value ? <span>{formatCurrency(r.value)}</span> : null}
                </div>
              </div>
              <button
                onClick={() => bringBack(r.id, r.date, 'cl')}
                disabled={busy === r.id}
                className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-white bg-[#1A56DB] rounded-lg hover:bg-[#1A4FBF] disabled:opacity-50 transition-colors shrink-0"
              >
                <RotateCcw className="w-3 h-3" /> Bring back
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Ghosted */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.06)' }}>
        <div className="px-5 py-4 border-b border-[#F1F5F9] flex items-center justify-between">
          <div>
            <p className="text-[13px] font-semibold text-[#0F172A]">Ghosted ({gh.length})</p>
            <p className="text-[11px] text-[#94A3B8]">Re-engage when you want to reach out again · date optional</p>
          </div>
          <span className="w-2.5 h-2.5 rounded-full bg-[#94A3B8]" />
        </div>
        <div className="divide-y divide-[#F1F5F9] max-h-[420px] overflow-y-auto">
          {gh.length === 0 ? (
            <p className="px-5 py-6 text-center text-[12px] text-[#94A3B8]">None right now.</p>
          ) : gh.map(r => (
            <div key={r.id} className="px-5 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-[#0F172A] truncate">{r.name}</p>
                <div className="flex flex-wrap items-center gap-x-3 text-[11px] text-[#94A3B8]">
                  {r.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{r.location}</span>}
                  <span>Ghosted {formatDate(r.date)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <input
                  type="date"
                  value={ghDates[r.id] ?? ''}
                  onChange={e => setGhDates(p => ({ ...p, [r.id]: e.target.value }))}
                  title="Optional follow-up date"
                  className="px-2 py-1 text-[11px] border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20"
                />
                <button
                  onClick={() => bringBack(r.id, ghDates[r.id] ?? null, 'gh')}
                  disabled={busy === r.id}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-white bg-[#1A56DB] rounded-lg hover:bg-[#1A4FBF] disabled:opacity-50 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" /> Bring back
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
