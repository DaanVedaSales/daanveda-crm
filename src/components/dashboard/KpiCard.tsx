import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface KpiCardProps {
  label: string
  value: string | number
  subtitle?: string
  accentColor?: string
  trend?: 'up' | 'down' | 'flat'
  trendLabel?: string
  className?: string
}

export default function KpiCard({
  label,
  value,
  subtitle,
  accentColor = '#1A56DB',
  trend,
  trendLabel,
  className,
}: KpiCardProps) {
  return (
    <div className={cn('relative bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm overflow-hidden', className)}>
      {/* Left accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl"
        style={{ backgroundColor: accentColor }}
      />

      <div className="pl-1">
        {/* Label */}
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#64748B] mb-2">
          {label}
        </p>

        {/* Value */}
        <p className="text-2xl font-bold text-[#0F172A] leading-none mb-1.5">
          {value}
        </p>

        {/* Subtitle + trend */}
        <div className="flex items-center gap-2">
          {subtitle && (
            <p className="text-xs text-[#94A3B8]">{subtitle}</p>
          )}
          {trend && trendLabel && (
            <span className={cn(
              'inline-flex items-center gap-0.5 text-xs font-medium',
              trend === 'up' && 'text-[#059669]',
              trend === 'down' && 'text-[#EF4444]',
              trend === 'flat' && 'text-[#94A3B8]',
            )}>
              {trend === 'up' && <TrendingUp className="w-3 h-3" />}
              {trend === 'down' && <TrendingDown className="w-3 h-3" />}
              {trend === 'flat' && <Minus className="w-3 h-3" />}
              {trendLabel}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
