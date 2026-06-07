'use client'

import { useState, useRef, useEffect } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'

// Outreach channels used by the "Reached out via" filter (mode of contact).
// Values match activities.channel (see CHANNEL_OUTCOMES in constants.ts).
export const OUTREACH_CHANNELS = ['Cold Call', 'Cold Email', 'LinkedIn', 'WhatsApp'] as const
export const CHANNEL_SHORT: Record<string, string> = { 'Cold Call': 'Call', 'Cold Email': 'Email', LinkedIn: 'LinkedIn', WhatsApp: 'WhatsApp' }

// A pill toggle showing a channel label + a lead-count badge.
export function ChannelChip({ label, count, active, disabled, onClick }: {
  label: string
  count: number
  active: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'px-2.5 py-1 text-[11px] font-medium rounded-full border transition-colors',
        active ? 'bg-[#1A56DB] text-white border-[#1A56DB]' : 'bg-white text-[#64748B] border-[#E2E8F0] hover:bg-[#F8FAFC]',
        disabled && !active && 'opacity-40 cursor-not-allowed hover:bg-white',
      )}
    >
      {label} <span className={cn('ml-0.5', active ? 'text-white/80' : 'text-[#94A3B8]')}>{count}</span>
    </button>
  )
}

// Collapsible "Reached out via" channel filter — a compact button that opens a
// popover of channel chips, so the header stays uncluttered until needed.
export function ChannelFilter({ value, counts, allCount, onChange }: {
  value: string | null
  counts: Record<string, number>
  allCount: number
  onChange: (v: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handle(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    if (open) document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  const active = value !== null
  const label = active ? `${CHANNEL_SHORT[value!] ?? value} · ${counts[value!] ?? 0}` : 'Channel'

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors',
          active ? 'border-[#1A56DB] text-[#1A56DB] bg-[#EFF4FE]' : 'border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]',
        )}
      >
        <SlidersHorizontal className="w-3.5 h-3.5" />
        {label}
      </button>
      {open && (
        <div className="absolute right-0 mt-1 z-30 bg-white rounded-xl border border-[#E2E8F0] shadow-lg p-3 w-[230px]">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8] mb-2">Reached out via</p>
          <div className="flex flex-wrap gap-1.5">
            <ChannelChip label="All" count={allCount} active={value === null} onClick={() => { onChange(null); setOpen(false) }} />
            {OUTREACH_CHANNELS.map(ch => (
              <ChannelChip
                key={ch}
                label={CHANNEL_SHORT[ch]}
                count={counts[ch] ?? 0}
                active={value === ch}
                disabled={(counts[ch] ?? 0) === 0}
                onClick={() => { onChange(value === ch ? null : ch); setOpen(false) }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
