'use client'

import { useState, useEffect } from 'react'
import TopBar from '@/components/layout/TopBar'
import { createClient } from '@/lib/supabase/client'
import { LEAD_STATUS_LABELS, LEAD_STATUS_COLORS } from '@/lib/constants'
import type { LeadStatus } from '@/types/database'
import { cn } from '@/lib/utils'
import { CheckCircle } from 'lucide-react'

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

function RowSkeleton() {
  return (
    <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#F1F5F9] last:border-0">
      <div className="space-y-2">
        <div className="h-3.5 w-36 bg-[#F1F5F9] rounded skeleton" />
        <div className="h-3 w-20 bg-[#F1F5F9] rounded skeleton" />
      </div>
      <div className="flex items-center gap-3">
        <div className="h-5 w-16 bg-[#F1F5F9] rounded-full skeleton" />
        <div className="h-3 w-12 bg-[#F1F5F9] rounded skeleton" />
      </div>
    </div>
  )
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
      <div className="flex-1 flex flex-col bg-[#F8FAFC]">
        <TopBar title="Follow-up Queue" subtitle="Loading..." />
        <div className="flex-1 p-6 space-y-5">
          {[...Array(2)].map((_, i) => (
            <div key={i}>
              <div className="h-4 w-20 bg-[#F1F5F9] rounded skeleton mb-2" />
              <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.06)' }}>
                <RowSkeleton />
                <RowSkeleton />
                <RowSkeleton />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (leads.length === 0) {
    return (
      <div className="flex-1 flex flex-col bg-[#F8FAFC]">
        <TopBar title="Follow-up Queue" subtitle="All clear" />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-sm text-center">
            <div className="w-12 h-12 rounded-2xl bg-[#F0FDF4] border border-[#BBF7D0] flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-6 h-6 text-[#059669]" strokeWidth={1.75} />
            </div>
            <h2 className="text-[15px] font-semibold text-[#0F172A] mb-2">Queue is clear</h2>
            <p className="text-[13px] text-[#64748B] leading-relaxed">
              No follow-ups pending — you're all caught up.
            </p>
          </div>
        </div>
      </div>
    )
  }

  function LeadRow({ lead }: { lead: FollowupLead }) {
    const since = daysSince(lead.updated_at)
    const isOverdue = lead.callback_date ? lead.callback_date < today : false
    const isToday = lead.callback_date === today
    return (
      <div className="flex items-center justify-between px-5 py-3.5 hover:bg-[#F8FAFC] transition-colors border-b border-[#F1F5F9] last:border-0">
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-[#0F172A] truncate">{lead.organization?.name}</p>
          <p className="text-[11px] text-[#94A3B8] mt-0.5">{lead.organization?.location}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-4">
          <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium border', LEAD_STATUS_COLORS[lead.status])}>
            {LEAD_STATUS_LABELS[lead.status]}
          </span>
          {lead.callback_date ? (
            <span className={cn(
              'text-[12px] font-semibold min-w-[60px] text-right',
              isOverdue ? 'text-[#EF4444]' : isToday ? 'text-[#1A56DB]' : 'text-[#64748B]'
            )}>
              {isOverdue && <span className="text-[10px] mr-1">Overdue</span>}
              {formatDate(lead.callback_date)}
            </span>
          ) : (
            <span className="text-[12px] text-[#94A3B8] min-w-[60px] text-right">
              {since !== null ? `${since}d ago` : '—'}
            </span>
          )}
        </div>
      </div>
    )
  }

  function Section({ title, items, accentColor }: { title: string; items: FollowupLead[]; accentColor: string }) {
    if (items.length === 0) return null
    return (
      <div>
        <h2 className="text-label mb-2" style={{ color: accentColor }}>
          {title} &middot; {items.length}
        </h2>
        <div
          className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden"
          style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.06)' }}
        >
          {items.map(l => <LeadRow key={l.id} lead={l} />)}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-[#F8FAFC]">
      <TopBar
        title="Follow-up Queue"
        subtitle={`${leads.length} pending · ${overdue.length} overdue · ${dueToday.length} today`}
      />
      <div className="flex-1 p-6 space-y-5 overflow-y-auto animate-in-page">
        <Section title="Overdue" items={overdue} accentColor="#EF4444" />
        <Section title="Today" items={dueToday} accentColor="#1A56DB" />
        <Section title="Upcoming" items={upcoming} accentColor="#64748B" />
        <Section title="No Date Set" items={unscheduled} accentColor="#94A3B8" />
      </div>
    </div>
  )
}
