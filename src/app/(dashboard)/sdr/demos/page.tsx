'use client'

import { useState, useEffect } from 'react'
import TopBar from '@/components/layout/TopBar'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Bell, BellOff, Clock, CalendarCheck, AlertCircle } from 'lucide-react'

interface BookedDemo {
  id: string
  demo_date: string
  status: string
  sdr_summary: string
  reminder_sent: boolean | null
  created_at: string
  organization: { name: string; location: string | null; url: string | null }
  closer: { name: string } | null
}

function daysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const demo = new Date(dateStr)
  demo.setHours(0, 0, 0, 0)
  return Math.ceil((demo.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function formatDemoDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

export default function SDRDemosPage() {
  const [demos, setDemos] = useState<BookedDemo[]>([])
  const [loading, setLoading] = useState(true)
  const [reminding, setReminding] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => { fetchDemos() }, [])

  async function fetchDemos() {
    const { data: user } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('users').select('id').eq('auth_id', user.user!.id).single()
    if (!profile) return

    const { data } = await supabase
      .from('demos')
      .select(`
        id, demo_date, status, sdr_summary, reminder_sent, created_at,
        organization:organizations(name, location, url),
        closer:users!demos_closer_id_fkey(name)
      `)
      .eq('sdr_id', profile.id)
      .in('status', ['scheduled', 'rescheduled'])
      .order('demo_date', { ascending: true })

    setDemos((data ?? []) as unknown as BookedDemo[])
    setLoading(false)
  }

  async function markReminder(demoId: string) {
    setReminding(demoId)
    await fetch(`/api/demos/${demoId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reminder_sent: true }),
    })
    setDemos(prev => prev.map(d => d.id === demoId ? { ...d, reminder_sent: true } : d))
    setReminding(null)
  }

  // Group demos into sections
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const todayDemos = demos.filter(d => daysUntil(d.demo_date) === 0)
  const tomorrowDemos = demos.filter(d => daysUntil(d.demo_date) === 1)
  const thisWeekDemos = demos.filter(d => { const n = daysUntil(d.demo_date); return n >= 2 && n <= 7 })
  const upcomingDemos = demos.filter(d => daysUntil(d.demo_date) > 7)
  const overdueDemos = demos.filter(d => daysUntil(d.demo_date) < 0)

  const needsReminder = demos.filter(d => !d.reminder_sent && daysUntil(d.demo_date) <= 1 && daysUntil(d.demo_date) >= 0)

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#1A56DB] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      <TopBar
        title="Booked Demos"
        subtitle={`${demos.length} upcoming${needsReminder.length > 0 ? ` · ${needsReminder.length} reminder${needsReminder.length > 1 ? 's' : ''} due` : ''}`}
      />

      <div className="flex-1 p-6 space-y-6 overflow-y-auto">

        {/* Reminder alert banner */}
        {needsReminder.length > 0 && (
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">
                {needsReminder.length} demo{needsReminder.length > 1 ? 's' : ''} need{needsReminder.length === 1 ? 's' : ''} a reminder today
              </p>
              <p className="text-xs text-amber-600 mt-0.5">
                Remind the organisation before their demo — a quick call or WhatsApp goes a long way.
              </p>
            </div>
          </div>
        )}

        {demos.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-[#94A3B8]">
            <CalendarCheck className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm font-medium">No booked demos yet</p>
            <p className="text-xs mt-1">Demos you book will appear here with reminder tracking.</p>
          </div>
        )}

        {overdueDemos.length > 0 && (
          <DemoSection title="⚠️ Overdue (Demo date passed)" demos={overdueDemos} onRemind={markReminder} reminding={reminding} urgent />
        )}
        {todayDemos.length > 0 && (
          <DemoSection title="Today" demos={todayDemos} onRemind={markReminder} reminding={reminding} urgent />
        )}
        {tomorrowDemos.length > 0 && (
          <DemoSection title="Tomorrow" demos={tomorrowDemos} onRemind={markReminder} reminding={reminding} urgent />
        )}
        {thisWeekDemos.length > 0 && (
          <DemoSection title="This Week" demos={thisWeekDemos} onRemind={markReminder} reminding={reminding} />
        )}
        {upcomingDemos.length > 0 && (
          <DemoSection title="Upcoming" demos={upcomingDemos} onRemind={markReminder} reminding={reminding} />
        )}

      </div>
    </div>
  )
}

function DemoSection({
  title, demos, onRemind, reminding, urgent = false
}: {
  title: string
  demos: BookedDemo[]
  onRemind: (id: string) => void
  reminding: string | null
  urgent?: boolean
}) {
  return (
    <div>
      <h2 className={cn(
        'text-xs font-semibold uppercase tracking-widest mb-3',
        urgent ? 'text-amber-600' : 'text-[#64748B]'
      )}>
        {title} ({demos.length})
      </h2>
      <div className="space-y-3">
        {demos.map(demo => <DemoCard key={demo.id} demo={demo} onRemind={onRemind} reminding={reminding} />)}
      </div>
    </div>
  )
}

function DemoCard({ demo, onRemind, reminding }: {
  demo: BookedDemo
  onRemind: (id: string) => void
  reminding: string | null
}) {
  const days = daysUntil(demo.demo_date)
  const isUrgent = days <= 1
  const isOverdue = days < 0

  const daysLabel = isOverdue
    ? `${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} overdue`
    : days === 0
    ? 'Today'
    : days === 1
    ? 'Tomorrow'
    : `In ${days} days`

  return (
    <div className={cn(
      'bg-white rounded-xl border p-4 shadow-sm',
      isOverdue ? 'border-red-200' : isUrgent ? 'border-amber-200' : 'border-[#E2E8F0]'
    )}>
      <div className="flex items-start justify-between gap-3">
        {/* Left: org info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="font-semibold text-[#0F172A] text-sm truncate">{demo.organization?.name}</p>
            {demo.status === 'rescheduled' && (
              <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full shrink-0">Rescheduled</span>
            )}
          </div>
          {demo.organization?.location && (
            <p className="text-xs text-[#94A3B8]">{demo.organization.location}</p>
          )}
          <div className="flex items-center gap-1.5 mt-1.5">
            <Clock className="w-3 h-3 text-[#94A3B8]" />
            <span className="text-xs text-[#64748B] font-medium">{formatDemoDate(demo.demo_date)}</span>
            <span className={cn(
              'text-[10px] font-semibold px-1.5 py-0.5 rounded-full ml-1',
              isOverdue ? 'bg-red-100 text-red-600' : isUrgent ? 'bg-amber-100 text-amber-700' : 'bg-blue-50 text-[#1A56DB]'
            )}>
              {daysLabel}
            </span>
          </div>
          <p className="text-[11px] text-[#64748B] mt-1">
            Closer: <span className="font-medium text-[#0F172A]">{demo.closer?.name ?? 'Unassigned'}</span>
          </p>
        </div>

        {/* Right: reminder button */}
        <div className="shrink-0 flex flex-col items-end gap-2">
          {demo.reminder_sent ? (
            <div className="flex items-center gap-1 text-[#059669] text-xs font-medium">
              <BellOff className="w-3.5 h-3.5" />
              <span>Reminded</span>
            </div>
          ) : (
            <button
              onClick={() => onRemind(demo.id)}
              disabled={reminding === demo.id}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                isUrgent
                  ? 'bg-amber-500 text-white hover:bg-amber-600'
                  : 'border border-[#E2E8F0] text-[#64748B] hover:border-[#1A56DB] hover:text-[#1A56DB]',
                reminding === demo.id && 'opacity-60'
              )}
            >
              <Bell className="w-3 h-3" />
              {reminding === demo.id ? 'Saving...' : 'Mark Reminded'}
            </button>
          )}
          <p className="text-[10px] text-[#94A3B8]">
            Booked {new Date(demo.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          </p>
        </div>
      </div>

      {/* SDR Summary snippet */}
      <div className="mt-3 p-2.5 bg-[#F8FAFC] rounded-lg border border-[#F1F5F9]">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8] mb-1">Your Summary for Closer</p>
        <p className="text-xs text-[#64748B] line-clamp-2">{demo.sdr_summary}</p>
      </div>
    </div>
  )
}
