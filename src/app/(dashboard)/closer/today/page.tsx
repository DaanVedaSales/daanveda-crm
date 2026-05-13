'use client'

import { useState, useEffect } from 'react'
import TopBar from '@/components/layout/TopBar'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { CheckCircle, XCircle, RefreshCw, ChevronDown, Bell, BellOff, Calendar, ExternalLink, Building2, Users, Banknote, Tag, AlertCircle, Target } from 'lucide-react'

interface DemoWithDetails {
  id: string
  demo_date: string
  status: string
  pain_point: string | null
  demo_expectation: string | null
  sdr_summary: string | null
  sdr_interest_signal: string | null
  post_demo_notes: string | null
  reminder_sent: boolean | null
  organization: {
    name: string
    location: string | null
    annual_revenue: number | null
    team_size: number | null
    thematic_areas: string[] | null
    linkedin_url: string | null
    url: string | null
  }
  sdr: { id: string; name: string } | null
  lead: { id: string; org_id: string } | null
}

interface UserOption { id: string; name: string }

type Filter = 'today' | 'tomorrow' | 'week' | 'all'

function formatTime(d: string) {
  return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function formatDay(d: string) {
  const date = new Date(d)
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const diff = Math.floor((new Date(date.toDateString()).getTime() - todayStart.getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
}

function CardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.06)' }}>
      <div className="h-9 bg-[#F1F5F9] skeleton" />
      <div className="p-5 space-y-3">
        <div className="h-4 w-40 bg-[#F1F5F9] rounded skeleton" />
        <div className="h-3 w-24 bg-[#F1F5F9] rounded skeleton" />
        <div className="h-16 bg-[#F8FAFC] rounded-xl skeleton mt-4" />
        <div className="flex gap-2 mt-4">
          <div className="h-9 flex-1 bg-[#F1F5F9] rounded-xl skeleton" />
          <div className="h-9 flex-1 bg-[#F1F5F9] rounded-xl skeleton" />
          <div className="h-9 flex-1 bg-[#F1F5F9] rounded-xl skeleton" />
        </div>
      </div>
    </div>
  )
}

export default function ActionsPage() {
  const [allDemos, setAllDemos] = useState<DemoWithDetails[]>([])
  const [filter, setFilter] = useState<Filter>('week')
  const [loading, setLoading] = useState(true)
  const [actionState, setActionState] = useState<Record<string, 'attended' | 'no_show' | 'reschedule' | null>>({})
  const [rescheduleDate, setRescheduleDate] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const [newSdrId, setNewSdrId] = useState<Record<string, string>>({})
  const [newCloserId, setNewCloserId] = useState<Record<string, string>>({})
  const [sdrs, setSdrs] = useState<UserOption[]>([])
  const [closers, setClosers] = useState<UserOption[]>([])

  const supabase = createClient()

  useEffect(() => {
    fetchData()
    fetch('/api/sdrs').then(r => r.json()).then(d => setSdrs(Array.isArray(d) ? d : []))
    fetch('/api/closers').then(r => r.json()).then(d => setClosers(Array.isArray(d) ? d : []))
  }, [])

  async function fetchData() {
    const { data: user } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('users').select('id').eq('auth_id', user.user!.id).single()
    if (!profile) return

    const { data } = await supabase
      .from('demos')
      .select(`
        id, demo_date, status, pain_point, demo_expectation, sdr_summary, sdr_interest_signal, post_demo_notes, reminder_sent,
        organization:organizations(name, location, annual_revenue, team_size, thematic_areas, linkedin_url, url),
        sdr:users!demos_sdr_id_fkey(id, name),
        lead:leads(id, org_id)
      `)
      .eq('closer_id', profile.id)
      .in('status', ['scheduled', 'rescheduled'])
      .gte('demo_date', new Date().toISOString().split('T')[0] + 'T00:00:00')
      .order('demo_date', { ascending: true })

    setAllDemos((data ?? []) as unknown as DemoWithDetails[])
    setLoading(false)
  }

  function getFiltered(): DemoWithDetails[] {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    return allDemos.filter(d => {
      const dDate = new Date(d.demo_date); dDate.setHours(0, 0, 0, 0)
      const diff = Math.floor((dDate.getTime() - todayStart.getTime()) / 86400000)
      if (filter === 'today') return diff === 0
      if (filter === 'tomorrow') return diff === 1
      if (filter === 'week') return diff <= 7
      return true
    })
  }

  function groupByDate(demos: DemoWithDetails[]) {
    const groups: { label: string; demos: DemoWithDetails[] }[] = []
    const seen: Record<string, number> = {}
    for (const d of demos) {
      const label = formatDay(d.demo_date)
      if (seen[label] === undefined) { seen[label] = groups.length; groups.push({ label, demos: [] }) }
      groups[seen[label]].demos.push(d)
    }
    return groups
  }

  async function handleDemoAction(demo: DemoWithDetails, action: 'attended' | 'no_show') {
    setSaving(demo.id)
    await fetch(`/api/demos/${demo.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: action }),
    })
    setAllDemos(prev => prev.filter(d => d.id !== demo.id))
    setSaving(null)
  }

  async function handleReschedule(demo: DemoWithDetails) {
    const newDate = rescheduleDate[demo.id]
    if (!newDate) return
    setSaving(demo.id)

    const payload: Record<string, unknown> = { reschedule_date: newDate }
    if (newSdrId[demo.id]) payload.new_sdr_id = newSdrId[demo.id]
    if (newCloserId[demo.id]) payload.new_closer_id = newCloserId[demo.id]

    await fetch(`/api/demos/${demo.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    setAllDemos(prev => prev.filter(d => d.id !== demo.id))
    setSaving(null)
  }

  const todayCount = allDemos.filter(d => formatDay(d.demo_date) === 'Today').length
  const filtered = getFiltered()
  const groups = groupByDate(filtered)

  if (loading) {
    return (
      <div className="flex-1 flex flex-col bg-[#F8FAFC]">
        <TopBar title="Upcoming Demos" subtitle="Loading..." />
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 pt-4 pb-3 flex gap-2 bg-white border-b border-[#E2E8F0]">
            {['Today', 'Tomorrow', 'Next 7 Days', 'All'].map(l => (
              <div key={l} className="h-7 w-20 bg-[#F1F5F9] rounded-full skeleton" />
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="space-y-3">
              <div className="h-4 w-20 bg-[#F1F5F9] rounded skeleton" />
              <CardSkeleton />
              <CardSkeleton />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-[#F8FAFC]">
      <TopBar
        title="Upcoming Demos"
        subtitle={`${allDemos.length} upcoming · ${todayCount} today`}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Filter bar */}
        <div className="px-6 pt-4 pb-3 flex gap-2 bg-white border-b border-[#E2E8F0]">
          {([['today', 'Today'], ['tomorrow', 'Tomorrow'], ['week', 'Next 7 Days'], ['all', 'All']] as [Filter, string][]).map(([v, label]) => (
            <button key={v} onClick={() => setFilter(v)}
              className={cn(
                'px-4 py-1.5 rounded-full text-xs font-medium transition-colors',
                filter === v ? 'bg-[#1A56DB] text-white' : 'bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]'
              )}>
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 animate-in-page">
          {groups.length === 0 ? (
            <div
              className="bg-white rounded-2xl border border-[#E2E8F0] p-12 text-center"
              style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.06)' }}
            >
              <div className="w-10 h-10 rounded-xl bg-[#F1F5F9] flex items-center justify-center mx-auto mb-3">
                <Calendar className="w-5 h-5 text-[#94A3B8]" strokeWidth={1.5} />
              </div>
              <p className="text-[13px] font-medium text-[#374151]">No demos in this period</p>
              <p className="text-[11px] text-[#94A3B8] mt-1">Scheduled demos will appear here</p>
            </div>
          ) : groups.map(group => (
            <div key={group.label}>
              <h2 className={cn(
                'text-label mb-3',
                group.label === 'Today' ? 'text-[#1A56DB]' : 'text-[#94A3B8]'
              )}>
                {group.label} &middot; {group.demos.length} {group.demos.length === 1 ? 'demo' : 'demos'}
              </h2>
              <div className="space-y-3">
                {group.demos.map(demo => {
                  const action = actionState[demo.id]
                  const isSaving = saving === demo.id
                  const isExpanded = expanded[demo.id]
                  const reminderSent = demo.reminder_sent === true

                  return (
                    <div
                      key={demo.id}
                      className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden"
                      style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.06)' }}
                    >
                      {/* ── Reminder strip ── */}
                      {reminderSent ? (
                        <div className="flex items-center gap-2 px-5 py-2.5 bg-[#F0FDF4] border-b border-[#BBF7D0]">
                          <Bell className="w-3.5 h-3.5 text-[#059669] shrink-0" strokeWidth={2} />
                          <p className="text-[12px] font-medium text-[#059669]">
                            SDR confirmed — org has been reminded of this demo
                          </p>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 px-5 py-2.5 bg-[#FFFBEB] border-b border-[#FDE68A]">
                          <BellOff className="w-3.5 h-3.5 text-[#B45309] shrink-0" strokeWidth={2} />
                          <p className="text-[12px] font-medium text-[#B45309]">
                            No reminder sent yet — SDR has not confirmed org follow-up
                          </p>
                        </div>
                      )}

                      <div className="p-5">
                        {/* Header row */}
                        <div className="flex items-start justify-between gap-3 mb-4">
                          <div>
                            <p className="text-[15px] font-semibold text-[#0F172A] tracking-tight">
                              {demo.organization?.name}
                            </p>
                            {demo.organization?.location && (
                              <p className="text-[12px] text-[#94A3B8] mt-0.5">{demo.organization.location}</p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-[13px] font-semibold text-[#1A56DB]">{formatTime(demo.demo_date)}</p>
                            {demo.status === 'rescheduled' && (
                              <span className="inline-block mt-1 text-[10px] bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                                Rescheduled
                              </span>
                            )}
                          </div>
                        </div>

                        {/* ── Expand toggle ── */}
                        <button
                          onClick={() => setExpanded(p => ({ ...p, [demo.id]: !p[demo.id] }))}
                          className="w-full flex items-center justify-between px-3.5 py-2.5 bg-[#F8FAFC] rounded-xl border border-[#F1F5F9] text-left hover:bg-[#F1F5F9] transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Building2 className="w-3.5 h-3.5 text-[#94A3B8]" strokeWidth={1.75} />
                            <p className="text-[12px] font-medium text-[#64748B]">
                              Org details & SDR intel{demo.sdr?.name ? ` · ${demo.sdr.name}` : ''}
                            </p>
                          </div>
                          <ChevronDown className={cn('w-3.5 h-3.5 text-[#94A3B8] transition-transform', isExpanded && 'rotate-180')} />
                        </button>

                        {/* ── Expanded section ── */}
                        {isExpanded && (
                          <div className="space-y-3 px-0.5">

                            {/* Org overview */}
                            <div className="p-3.5 bg-[#F8FAFC] rounded-xl border border-[#F1F5F9] space-y-2.5">
                              <p className="text-label text-[#94A3B8] flex items-center gap-1.5">
                                <Building2 className="w-3 h-3" strokeWidth={2} /> Org Overview
                              </p>

                              {demo.organization.thematic_areas && demo.organization.thematic_areas.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                  {demo.organization.thematic_areas.map((t: string, i: number) => (
                                    <span key={i} className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 bg-[#EFF6FF] text-[#1A56DB] border border-[#BFDBFE] rounded-full">
                                      <Tag className="w-2.5 h-2.5" strokeWidth={2} />{t}
                                    </span>
                                  ))}
                                </div>
                              )}

                              <div className="flex flex-wrap gap-4">
                                {demo.organization.team_size && (
                                  <div className="flex items-center gap-1.5 text-[12px] text-[#374151]">
                                    <Users className="w-3 h-3 text-[#94A3B8]" strokeWidth={2} />
                                    <span>{demo.organization.team_size} people</span>
                                  </div>
                                )}
                                {demo.organization.annual_revenue && (
                                  <div className="flex items-center gap-1.5 text-[12px] text-[#374151]">
                                    <Banknote className="w-3 h-3 text-[#94A3B8]" strokeWidth={2} />
                                    <span>₹{(demo.organization.annual_revenue / 100000).toFixed(0)}L revenue</span>
                                  </div>
                                )}
                              </div>

                              {(demo.organization.linkedin_url || demo.organization.url) && (
                                <div className="flex gap-2">
                                  {demo.organization.linkedin_url && (
                                    <a href={demo.organization.linkedin_url} target="_blank" rel="noreferrer"
                                      className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 bg-[#EFF6FF] text-[#1A56DB] border border-[#BFDBFE] rounded-lg hover:bg-[#DBEAFE] transition-colors">
                                      <ExternalLink className="w-2.5 h-2.5" strokeWidth={2.5} /> LinkedIn
                                    </a>
                                  )}
                                  {demo.organization.url && (
                                    <a href={demo.organization.url} target="_blank" rel="noreferrer"
                                      className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 bg-[#F8FAFC] text-[#374151] border border-[#E2E8F0] rounded-lg hover:bg-[#F1F5F9] transition-colors">
                                      <ExternalLink className="w-2.5 h-2.5" strokeWidth={2.5} /> Website
                                    </a>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* SDR Intel */}
                            {(demo.pain_point || demo.demo_expectation || demo.sdr_summary) && (
                              <div className="p-3.5 bg-[#FFFBEB] rounded-xl border border-[#FDE68A] space-y-2.5">
                                <p className="text-label text-[#92400E] flex items-center gap-1.5">
                                  SDR Intel{demo.sdr?.name ? ` · ${demo.sdr.name}` : ''}
                                  {demo.sdr_interest_signal && (
                                    <span className={cn(
                                      'ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full',
                                      demo.sdr_interest_signal === 'hot' ? 'bg-red-100 text-red-700' :
                                      demo.sdr_interest_signal === 'warm' ? 'bg-amber-100 text-amber-700' :
                                      'bg-slate-100 text-slate-600'
                                    )}>
                                      {demo.sdr_interest_signal.toUpperCase()}
                                    </span>
                                  )}
                                </p>

                                {demo.pain_point && (
                                  <div>
                                    <div className="flex items-center gap-1.5 mb-1">
                                      <AlertCircle className="w-3 h-3 text-[#D97706]" strokeWidth={2} />
                                      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#D97706]">Main Pain Point</p>
                                    </div>
                                    <p className="text-[12px] text-[#374151] leading-relaxed pl-4">{demo.pain_point}</p>
                                  </div>
                                )}

                                {demo.demo_expectation && (
                                  <div>
                                    <div className="flex items-center gap-1.5 mb-1">
                                      <Target className="w-3 h-3 text-[#D97706]" strokeWidth={2} />
                                      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#D97706]">Expecting from Demo</p>
                                    </div>
                                    <p className="text-[12px] text-[#374151] leading-relaxed pl-4">{demo.demo_expectation}</p>
                                  </div>
                                )}

                                {demo.sdr_summary && (
                                  <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8] mb-1">Additional Notes</p>
                                    <p className="text-[12px] text-[#64748B] leading-relaxed">{demo.sdr_summary}</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* ── Action zone ── */}
                      {!action ? (
                        <div className="px-5 pb-5 flex gap-2 flex-wrap">
                          <button
                            onClick={() => setActionState(p => ({ ...p, [demo.id]: 'attended' }))}
                            className="btn-success flex items-center gap-1.5"
                          >
                            <CheckCircle className="w-3.5 h-3.5" strokeWidth={2} /> Attended
                          </button>
                          <button
                            onClick={() => setActionState(p => ({ ...p, [demo.id]: 'no_show' }))}
                            className="btn-danger flex items-center gap-1.5"
                          >
                            <XCircle className="w-3.5 h-3.5" strokeWidth={2} /> No Show
                          </button>
                          <button
                            onClick={() => setActionState(p => ({ ...p, [demo.id]: 'reschedule' }))}
                            className="btn-ghost flex items-center gap-1.5"
                          >
                            <RefreshCw className="w-3.5 h-3.5" strokeWidth={2} /> Reschedule
                          </button>
                        </div>

                      ) : action === 'attended' ? (
                        <div className="px-5 py-4 bg-[#F0FDF4] border-t border-[#BBF7D0] flex items-center justify-between">
                          <p className="text-[13px] text-[#059669] font-medium">Confirm demo was attended?</p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleDemoAction(demo, 'attended')}
                              disabled={isSaving}
                              className="px-4 py-1.5 bg-[#059669] text-white text-xs font-semibold rounded-lg disabled:opacity-60 hover:bg-[#047857]"
                            >
                              {isSaving ? 'Saving...' : 'Yes, Attended'}
                            </button>
                            <button
                              onClick={() => setActionState(p => ({ ...p, [demo.id]: null }))}
                              className="px-3 py-1.5 text-xs text-[#64748B] hover:text-[#0F172A]"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>

                      ) : action === 'no_show' ? (
                        <div className="px-5 py-4 bg-red-50 border-t border-red-100 flex items-center justify-between">
                          <p className="text-[13px] text-[#EF4444] font-medium">Confirm no show?</p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleDemoAction(demo, 'no_show')}
                              disabled={isSaving}
                              className="px-4 py-1.5 bg-[#EF4444] text-white text-xs font-semibold rounded-lg disabled:opacity-60 hover:bg-[#DC2626]"
                            >
                              {isSaving ? 'Saving...' : 'Confirm No Show'}
                            </button>
                            <button
                              onClick={() => setActionState(p => ({ ...p, [demo.id]: null }))}
                              className="px-3 py-1.5 text-xs text-[#64748B] hover:text-[#0F172A]"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>

                      ) : action === 'reschedule' ? (
                        <div className="px-5 pb-5 pt-1 border-t border-[#E2E8F0] space-y-3">
                          <p className="text-label text-[#94A3B8] mt-3">Reschedule Demo</p>

                          <div>
                            <label className="block text-[11px] font-medium text-[#64748B] mb-1.5">
                              New Date & Time <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="datetime-local"
                              value={rescheduleDate[demo.id] ?? ''}
                              onChange={e => setRescheduleDate(p => ({ ...p, [demo.id]: e.target.value }))}
                              min={new Date().toISOString().slice(0, 16)}
                              className="field"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-medium text-[#64748B] mb-1.5">
                              Reassign SDR{' '}
                              <span className="text-[#94A3B8] font-normal">(optional — returns lead to SDR workspace)</span>
                            </label>
                            <select
                              value={newSdrId[demo.id] ?? ''}
                              onChange={e => setNewSdrId(p => ({ ...p, [demo.id]: e.target.value }))}
                              className="field"
                            >
                              <option value="">Keep current SDR{demo.sdr?.name ? ` (${demo.sdr.name})` : ''}</option>
                              {sdrs.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] font-medium text-[#64748B] mb-1.5">
                              Reassign Closer{' '}
                              <span className="text-[#94A3B8] font-normal">(optional — moves deal to their pipeline)</span>
                            </label>
                            <select
                              value={newCloserId[demo.id] ?? ''}
                              onChange={e => setNewCloserId(p => ({ ...p, [demo.id]: e.target.value }))}
                              className="field"
                            >
                              <option value="">Keep current Closer</option>
                              {closers.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          </div>

                          <div className="flex gap-2 items-center pt-1">
                            <button
                              onClick={() => handleReschedule(demo)}
                              disabled={isSaving || !rescheduleDate[demo.id]}
                              className="btn-primary flex-1 disabled:opacity-60"
                            >
                              {isSaving ? 'Saving...' : 'Confirm Reschedule'}
                            </button>
                            <button
                              onClick={() => setActionState(p => ({ ...p, [demo.id]: null }))}
                              className="btn-ghost"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
