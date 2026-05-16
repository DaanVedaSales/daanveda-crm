'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { ADMIN_NAV, SDR_NAV, CLOSER_NAV } from '@/lib/constants'
import {
  LayoutDashboard, Database, Users, UserCheck, ClipboardList,
  Clock, Kanban, Calendar, History, LogOut, CalendarCheck,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import type { UserRole } from '@/types/database'
import { createClient } from '@/lib/supabase/client'

const ICON_MAP: Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  LayoutDashboard, Database, Users, UserCheck, ClipboardList,
  Clock, Kanban, Calendar, History, CalendarCheck,
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin:     'Admin',
  sdr:       'SDR Workspace',
  closer:    'Closer',
  sales_ops: 'Sales Ops',
}

const NAV_MAP: Record<UserRole, typeof ADMIN_NAV> = {
  admin:     ADMIN_NAV,
  sdr:       SDR_NAV,
  closer:    CLOSER_NAV,
  sales_ops: ADMIN_NAV,
}

interface SidebarProps {
  role: UserRole
  userName: string
}

export default function Sidebar({ role, userName }: SidebarProps) {
  const pathname = usePathname()
  const router   = useRouter()
  const navItems = NAV_MAP[role] ?? SDR_NAV
  const initials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  // Collapsible state — persist in localStorage; default collapsed for premium look
  const [collapsed, setCollapsed] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const stored = localStorage.getItem('dv-sidebar-collapsed')
      if (stored !== null) setCollapsed(stored === 'true')
    } catch {}
  }, [])

  function toggle() {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem('dv-sidebar-collapsed', String(next)) } catch {}
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  // Prevent flicker — render collapsed state only after mount
  const isCollapsed = mounted ? collapsed : false

  return (
    <aside
      className={cn(
        'relative h-screen flex flex-col shrink-0 transition-all duration-200 ease-out select-none sticky top-0',
        isCollapsed ? 'w-16' : 'w-60',
      )}
      style={{
        background: 'linear-gradient(180deg, #0F172A 0%, #111827 100%)',
      }}
    >
      {/* ── Logo area ───────────────────────────────────────────────────── */}
      <div className={cn('flex items-center gap-3 px-4 pt-5 pb-4', isCollapsed && 'justify-center px-0')}>
        <div className="w-8 h-8 bg-[#1A56DB] rounded-xl flex items-center justify-center shrink-0 shadow-glow-blue">
          <span className="text-white font-bold text-sm tracking-tight">D</span>
        </div>
        {!isCollapsed && (
          <div className="animate-fade-in min-w-0">
            <span className="text-white font-semibold text-[15px] tracking-tight leading-none">DaanVeda</span>
            <p className="text-[10px] font-medium tracking-[0.08em] uppercase text-[#64748B] mt-0.5">
              {ROLE_LABELS[role]}
            </p>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className={cn('mx-3 h-px bg-white/[0.06] mb-2', isCollapsed && 'mx-2')} />

      {/* ── Navigation ──────────────────────────────────────────────────── */}
      <nav className={cn('flex-1 min-h-0 overflow-y-auto px-2 py-1 space-y-0.5', isCollapsed && 'px-1.5')}>
        {navItems.map((item) => {
          const Icon   = ICON_MAP[item.icon]
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')

          return (
            <div key={item.href} className="relative group">
              <Link
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                  isCollapsed && 'justify-center px-0 py-3',
                  isActive
                    ? 'bg-[#1A56DB]/[0.15] text-white'
                    : 'text-[#94A3B8] hover:text-white hover:bg-white/[0.05]',
                )}
              >
                {/* Active indicator */}
                {isActive && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-[#1A56DB] rounded-r-full" />
                )}

                {Icon && (
                  <Icon
                    className={cn('shrink-0 transition-transform duration-150', isActive ? 'w-4 h-4' : 'w-4 h-4')}
                    strokeWidth={isActive ? 2 : 1.75}
                  />
                )}

                {!isCollapsed && (
                  <span className="truncate animate-fade-in">{item.label}</span>
                )}
              </Link>

              {/* Tooltip in collapsed mode */}
              {isCollapsed && (
                <div className="
                  pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2.5 z-50
                  opacity-0 group-hover:opacity-100 transition-opacity duration-150
                ">
                  <div className="px-2.5 py-1.5 bg-[#1E293B] text-white text-xs font-medium rounded-lg shadow-float whitespace-nowrap border border-white/10">
                    {item.label}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* ── Collapse toggle ──────────────────────────────────────────────── */}
      <div className={cn('px-2 pb-2', isCollapsed && 'px-1.5')}>
        <button
          onClick={toggle}
          className={cn(
            'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[#64748B]',
            'hover:text-white hover:bg-white/[0.05] transition-all duration-150',
            isCollapsed && 'justify-center px-0',
          )}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4 shrink-0" />
              <span className="text-xs font-medium animate-fade-in">Collapse</span>
            </>
          )}
        </button>
      </div>

      {/* Divider */}
      <div className={cn('mx-3 h-px bg-white/[0.06]', isCollapsed && 'mx-2')} />

      {/* ── User footer ──────────────────────────────────────────────────── */}
      <div className={cn('px-2 py-4', isCollapsed && 'px-1.5')}>
        {isCollapsed ? (
          <div className="group relative flex justify-center">
            <div className="w-8 h-8 rounded-xl bg-[#1A56DB]/25 flex items-center justify-center cursor-default">
              <span className="text-[#93C5FD] text-xs font-semibold">{initials}</span>
            </div>
            {/* Tooltip */}
            <div className="
              pointer-events-none absolute left-full bottom-0 ml-2.5 z-50
              opacity-0 group-hover:opacity-100 transition-opacity duration-150
            ">
              <div className="px-2.5 py-1.5 bg-[#1E293B] text-white text-xs font-medium rounded-lg shadow-float whitespace-nowrap border border-white/10">
                {userName}
                <span className="block text-[#64748B] text-[10px] mt-0.5 capitalize">{role} · Sign out</span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="absolute inset-0 rounded-xl"
              title="Sign out"
            />
          </div>
        ) : (
          <div className="flex items-center gap-2.5 px-1 animate-fade-in">
            <div className="w-8 h-8 rounded-xl bg-[#1A56DB]/25 flex items-center justify-center shrink-0">
              <span className="text-[#93C5FD] text-xs font-semibold">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-[13px] font-medium truncate leading-tight">{userName}</p>
              <p className="text-[#64748B] text-[10px] capitalize mt-0.5">{role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-[#64748B] hover:text-white hover:bg-white/[0.05] transition-colors"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
