'use client'

import { useState, useEffect } from 'react'
import TopBar from '@/components/layout/TopBar'
import { createClient } from '@/lib/supabase/client'
import { LEAD_STATUS_LABELS, LEAD_STATUS_COLORS } from '@/lib/constants'
import type { LeadStatus } from '@/types/database'
import { cn } from '@/lib/utils'

interface FollowupLead {
  id: string
  status: LeadStatus
  callback_date: string | null
  follow_up_date: string | null
  updated_at: string | null
  organization: { name: string; location: string | null }
}

function formatDate(d: string | null) {
  if (!d) return null
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function daysSince(d: string | null) {
  if (!d) return null
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
}

export default function FollowupsPage() {
  const [leads, setLeads] = useState<FollowupLead[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => { fetchLeads() }, [])

  async function fetchLeads() {
    const { data: user } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('users').select('id').eq('auth_id', user.user!.id).single()
    if (!profile) return

    const { data } = await supabase
      .from('leads')
      .select('id, status, callback_date, follow_up_date, updated_at, organization:organizations(name, location)')
      .eq('assigned_to', profile.id)
      .in('status', ['call_again', 'not_reachable'])
      .order('callback_date', { ascending: true, nullsFirst: false })

    setLeads((data ?? []) as unknown as FollowupLead[])
    setLoading(false)
  }

  const today = new Date().toISOString().split('T')[0]
  const overdue = leads.filter(l => l.callback_date && l.callback_date < today)
  const dueToday = leads.filter(l => l.callback_date === today)
  const upcoming = leads.filter(l => l.callback_date && l.callback_date > today)
  const unscheduled = leads.filter(l => !l.callback_date)

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#1A56DB] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  function LeadRow({ lead }: { lead: FollowupLead }) {
    const since = daysSince(lead.updated_at)
    return (
      <div className="flex items-center justify-between px-5 py-3.5 hover:bg-[#F8FAFC] transition-colors border-b border-[#F1F5F9] last:border-0">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-[#0F172A] truncate">{lead.organization?.name}</p>
          <p className="text-xs text-[#94A3B8] mt-0.5">{lead.organization?.location}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-4">
          <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', LEAD_STATUS_COLORS[lead.status])}>
            {LEAD_STATUS_LABELS[lead.status]}
          </span>
          {lead.callback_date ? (
            <span className={cn('text-xs font-medium min-w-[60px] text-right',
              lead.callback_date < today ? 'text-[#EF4444]'
              : lead.callback_date === today ? 'text-[#1A56DB]'
              : 'text-[#64748B]'
            )}>
              {formatDate(lead.callback_date)}
            </span>
          ) : (
            <span className="text-xs text-[#94A3B8] min-w-[60px] text-right">
              {since !== null ? `${since}d ago` : '—'}
            </span>
          )}
        </div>
      </div>
    )
  }

  function Section({ title, items, color }: { title: string; items: FollowupLead[]; color: string }) {
    if (items.length === 0) return null
    return (
      <div>
        <h2 className={cn('text-xs font-semibold uppercase tracking-widest mb-2', color)}>
          {title} ({items.length})
        </h2>
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
          {items.map(l => <LeadRow key={l.id} lead={l} />)}
        </div>
      </div>
    )
  }

  if (leads.length === 0) {
    return (
      <div className="flex-1 flex flex-col">
        <TopBar title="Follow-up Queue" subtitle="All clear" />
        <div className="flex-1 flex items-center justify-center text-[#94A3B8] flex-col gap-2">
          <p className="text-2xl">🎉</p>
          <p className="text-sm">No follow-ups pending — great work!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      <TopBar
        title="Follow-up Queue"
        subtitle={`${leads.length} pending · ${overdue.length} overdue · ${dueToday.length} today`}
      />
      <div className="flex-1 p-6 space-y-5 overflow-y-auto">
        <Section title="Overdue" items={overdue} color="text-[#EF4444]" />
        <Section title="Today" items={dueToday} color="text-[#1A56DB]" />
        <Section title="Upcoming" items={upcoming} color="text-[#64748B]" />
        <Section title="No Date Set — Call When Ready" items={unscheduled} color="text-[#94A3B8]" />
      </div>
    </div>
  )
}
