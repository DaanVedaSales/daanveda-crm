import { cn } from '@/lib/utils'

interface KpiCardProps {
  label: string
  value: string | number
  subtitle?: string
  accentColor?: string
  className?: string
}

export default function KpiCard({
  label,
  value,
  subtitle,
  accentColor = '#1A56DB',
  className,
}: KpiCardProps) {
  return (
    <div
      className={cn(
        'relative bg-white rounded-2xl border border-[#E2E8F0] p-5 overflow-hidden transition-shadow duration-150',
        className,
      )}
      style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.06)' }}
    >
      {/* Left accent bar */}
      <div
        className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full"
        style={{ backgroundColor: accentColor }}
      />

      <div className="pl-3">
        <p className="text-label text-[#64748B] mb-2.5">{label}</p>
        <p
          className="text-[1.625rem] font-bold text-[#0F172A] leading-none mb-1.5 tabular"
          style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}
        >
          {value}
        </p>
        {subtitle && (
          <p className="text-[11px] text-[#94A3B8]">{subtitle}</p>
        )}
      </div>
    </div>
  )
}
