'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { ADMIN_NAV, SDR_NAV, CLOSER_NAV } from '@/lib/constants'
import {
  LayoutDashboard, Database, Users, UserCheck, ClipboardList,
  Clock, Kanban, Calendar, History, LogOut
} from 'lucide-react'
import type { UserRole } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, Database, Users, UserCheck, ClipboardList,
  Clock, Kanban, Calendar, History,
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'ADMIN',
  sdr: 'SDR WORKSPACE',
  closer: 'CLOSER WORKSPACE',
  sales_ops: 'SALES OPS',
}

const NAV_MAP: Record<UserRole, typeof ADMIN_NAV> = {
  admin: ADMIN_NAV,
  sdr: SDR_NAV,
  closer: CLOSER_NAV,
  sales_ops: ADMIN_NAV,
}

interface SidebarProps {
  role: UserRole
  userName: string
}

export default function Sidebar({ role, userName }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const navItems = NAV_MAP[role] ?? SDR_NAV

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="w-60 min-h-screen bg-[#0F172A] flex flex-col shrink-0">
      {/* Logo */}
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-[#1A56DB] rounded-lg flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-sm">D</span>
          </div>
          <span className="text-white font-semibold text-base tracking-tight">DaanVeda</span>
        </div>
        {/* Role badge */}
        <div className="mt-3">
          <span className="text-[9px] font-semibold tracking-widest text-[#1A56DB] bg-[#1A56DB]/10
                           px-2 py-1 rounded">
            {ROLE_LABELS[role]}
          </span>
        </div>
      </div>

      <div className="px-3 py-1">
        <div className="h-px bg-white/5" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {navItems.map((item) => {
          const Icon = ICON_MAP[item.icon]
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                isActive
                  ? 'bg-[#1A56DB]/15 text-white relative'
                  : 'text-[#A0AEC4] hover:text-white hover:bg-white/5'
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-2 bottom-2 w-0.5 bg-[#1A56DB] rounded-r" />
              )}
              {Icon && <Icon className="w-4 h-4 shrink-0" />}
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User footer */}
      <div className="px-3 pb-5 pt-2">
        <div className="h-px bg-white/5 mb-3" />
        <div className="flex items-center gap-2.5 px-2">
          <div className="w-8 h-8 rounded-full bg-[#1A56DB]/30 flex items-center justify-center">
            <span className="text-[#1A56DB] text-xs font-semibold uppercase">
              {userName.charAt(0)}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-medium truncate">{userName}</p>
            <p className="text-[#A0AEC4] text-[10px] capitalize">{role}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-[#A0AEC4] hover:text-white transition-colors"
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  )
}
