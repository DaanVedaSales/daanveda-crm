'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bell, CalendarPlus, CalendarX, CalendarClock, ArrowRightLeft,
  RotateCcw, UserPlus, ClipboardCheck, Trophy, Check,
} from 'lucide-react'
import { IST_TIMEZONE } from '@/lib/utils'

type Notification = {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  is_read: boolean
  created_at: string
}

const TYPE_ICON: Record<string, typeof Bell> = {
  demo_booked: CalendarPlus,
  demo_no_show: CalendarX,
  demo_rescheduled: CalendarClock,
  demo_reassigned: ArrowRightLeft,
  lead_returned: RotateCcw,
  lead_assigned: UserPlus,
  request_decision: ClipboardCheck,
  deal_won: Trophy,
}

const POLL_MS = 60_000

function istDateKey(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(iso))
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIMEZONE, day: 'numeric', month: 'short',
  }).format(new Date(iso))
}

export default function NotificationBell() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      if (Array.isArray(data.items)) setItems(data.items)
      setUnread(typeof data.unread === 'number' ? data.unread : 0)
    } catch {
      /* best-effort: leave existing state on transient failure */
    }
  }, [])

  // Initial load + polling + refetch when the tab regains focus.
  useEffect(() => {
    load()
    const timer = setInterval(load, POLL_MS)
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    return () => { clearInterval(timer); window.removeEventListener('focus', onFocus) }
  }, [load])

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  const markRead = useCallback(async (id: string) => {
    setItems(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    setUnread(prev => Math.max(0, prev - 1))
    try {
      await fetch('/api/notifications/read', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
    } catch { /* optimistic; a reload reconciles */ }
  }, [])

  const markAllRead = useCallback(async () => {
    setItems(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnread(0)
    try {
      await fetch('/api/notifications/read', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      })
    } catch { /* optimistic; a reload reconciles */ }
  }, [])

  const onRowClick = useCallback((n: Notification) => {
    if (!n.is_read) markRead(n.id)
    if (n.link) { setOpen(false); router.push(n.link) }
  }, [markRead, router])

  const todayKey = istDateKey(new Date().toISOString())
  const today = items.filter(n => istDateKey(n.created_at) === todayKey)
  const earlier = items.filter(n => istDateKey(n.created_at) !== todayKey)

  const renderGroup = (label: string, group: Notification[]) => {
    if (group.length === 0) return null
    return (
      <div>
        <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8] bg-[#F8FAFC]">{label}</p>
        {group.map(n => {
          const Icon = TYPE_ICON[n.type] ?? Bell
          return (
            <button
              key={n.id}
              onClick={() => onRowClick(n)}
              className={`w-full flex gap-3 px-4 py-3 text-left border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors ${n.is_read ? '' : 'bg-[#1A56DB]/[0.03]'}`}
            >
              <span className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${n.is_read ? 'bg-[#F1F5F9] text-[#94A3B8]' : 'bg-[#1A56DB]/10 text-[#1A56DB]'}`}>
                <Icon className="w-3.5 h-3.5" strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className={`text-[13px] leading-tight truncate ${n.is_read ? 'font-medium text-[#334155]' : 'font-semibold text-[#0F172A]'}`}>{n.title}</span>
                  {!n.is_read && <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-[#1A56DB]" />}
                </span>
                {n.body && <span className="block text-[12px] text-[#64748B] mt-0.5 leading-snug line-clamp-2">{n.body}</span>}
                <span className="block text-[11px] text-[#94A3B8] mt-1">{relativeTime(n.created_at)}</span>
              </span>
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative w-8 h-8 flex items-center justify-center rounded-lg text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors"
        title="Notifications"
      >
        <Bell className="w-4 h-4" strokeWidth={1.75} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[#EF4444] text-white text-[10px] font-semibold flex items-center justify-center leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[380px] max-w-[calc(100vw-2rem)] bg-white border border-[#E2E8F0] rounded-xl shadow-lg overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#E2E8F0]">
            <p className="text-[13px] font-semibold text-[#0F172A]">Notifications</p>
            {unread > 0 && (
              <button onClick={markAllRead} className="flex items-center gap-1 text-[11px] font-medium text-[#1A56DB] hover:underline">
                <Check className="w-3 h-3" strokeWidth={2.5} /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <Bell className="w-6 h-6 text-[#CBD5E1] mx-auto mb-2" strokeWidth={1.5} />
                <p className="text-[13px] text-[#64748B]">You&apos;re all caught up</p>
              </div>
            ) : (
              <>
                {renderGroup('Today', today)}
                {renderGroup('Earlier', earlier)}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
