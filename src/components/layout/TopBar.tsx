'use client'

import { Bell } from 'lucide-react'

interface TopBarProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode  // optional right-side action slot
}

export default function TopBar({ title, subtitle, actions }: TopBarProps) {
  return (
    <header className="h-14 bg-white border-b border-[#E8EDF3] flex items-center px-6 gap-4 shrink-0">
      {/* Title */}
      <div className="flex-1 min-w-0">
        <h1 className="text-[15px] font-semibold text-[#0F172A] truncate tracking-[-0.01em] leading-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-[11px] text-[#94A3B8] mt-0.5 truncate">{subtitle}</p>
        )}
      </div>

      {/* Optional action slot (Add button, filters, etc.) */}
      {actions && (
        <div className="flex items-center gap-2 shrink-0">
          {actions}
        </div>
      )}

      {/* Bell — right anchor */}
      <button
        className="relative w-8 h-8 flex items-center justify-center rounded-lg text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors"
        title="Notifications"
      >
        <Bell className="w-4 h-4" strokeWidth={1.75} />
      </button>
    </header>
  )
}
