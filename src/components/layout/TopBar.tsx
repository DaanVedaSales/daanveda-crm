'use client'

import { Bell, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { getDailyPace, getWorkingDaysElapsed, formatCurrency } from '@/lib/utils'

interface TopBarProps {
  title: string
  subtitle?: string
  // Context bar — shown for SDR/Closer
  monthlyTarget?: number
  achieved?: number
  role?: string
}

export default function TopBar({ title, subtitle, monthlyTarget, achieved, role }: TopBarProps) {
  const today = new Date()
  const month = today.getMonth() + 1
  const year = today.getFullYear()
  const daysElapsed = getWorkingDaysElapsed(year, month)
  const dailyPace = monthlyTarget ? getDailyPace(monthlyTarget) : 0
  const expectedByNow = dailyPace * daysElapsed
  const paceRatio = expectedByNow > 0 ? (achieved ?? 0) / expectedByNow : 1

  return (
    <header className="h-14 bg-white border-b border-[#E2E8F0] flex items-center px-6 gap-4 shrink-0">
      {/* Title */}
      <div className="flex-1 min-w-0">
        <h1 className="text-sm font-semibold text-[#0F172A] truncate">{title}</h1>
        {subtitle && <p className="text-[11px] text-[#64748B]">{subtitle}</p>}
      </div>

      {/* Topbar context — working days + pace */}
      {monthlyTarget !== undefined && (
        <div className="hidden md:flex items-center gap-4 text-xs text-[#64748B]">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            <span>Day {daysElapsed}/26</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[#94A3B8]">Expected:</span>
            <span className="font-medium text-[#0F172A]">
              {role === 'sdr' ? `${Math.round(expectedByNow)} demos` : formatCurrency(expectedByNow)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[#94A3B8]">Actual:</span>
            <span className={`font-semibold ${paceRatio >= 1 ? 'text-[#059669]' : paceRatio >= 0.8 ? 'text-[#F59E0B]' : 'text-[#EF4444]'}`}>
              {role === 'sdr' ? `${achieved ?? 0} demos` : formatCurrency(achieved ?? 0)}
            </span>
          </div>
        </div>
      )}

      {/* Date */}
      <div className="hidden lg:block text-xs text-[#94A3B8]">
        {format(today, 'EEE, dd MMM yyyy')}
      </div>

      {/* Notification bell */}
      <button className="relative w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F8FAFC] transition-colors">
        <Bell className="w-4 h-4 text-[#64748B]" />
      </button>
    </header>
  )
}
