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
