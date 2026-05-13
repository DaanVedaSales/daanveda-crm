'use client'

import { useState, useEffect } from 'react'
import TopBar from '@/components/layout/TopBar'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { CheckCircle, XCircle, RefreshCw, ChevronDown, Bell } from 'lucide-react'

interface DemoWithDetails {
  id: string
  demo_date: string
  status: string
  sdr_summary: string
  post_demo_notes: string | null
  reminder_sent: boolean | null
  organization: { name: string; location: string | null }
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

export default function ActionsPage() {
  const [allDemos, setAllDemos] = useState<DemoWithDetails[]>([])
  const [filter, setFilter] = useState<Filter>('week')
  const [loading, setLoading] = useState(true)
  const [actionState, setActionState] = useState<Record<string, 'attended' | 'no_show' | 'reschedule' | null>>({})
  const [rescheduleDate, setRescheduleDate] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  // Reassignment state
  const [newSdrId, setNewSdrId] = useState<Record<string, string>>({})
  const [newCloserId, setNewCloserId] = useState<Record<string, string>>({})
  const [sdrs, setSdrs] = useState<UserOption[]>([])
  const [closers, setClosers] = useState<UserOption[]>([])

  const supabase = createClient()

  useEffect(() => {
    fetchData()
    // Preload SDR and Closer lists for reassignment dropdowns
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
        id, demo_date, status, sdr_summary, post_demo_notes, reminder_sent,
        organization:organizations(name, location),
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

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-[#1A56DB] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="flex-1 flex flex-col">
      <TopBar
        title="Upcoming Demos"
        subtitle={`${allDemos.length} upcoming · ${todayCount} today`}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Filter bar */}
        <div className="px-6 pt-4 pb-3 flex gap-2 bg-white border-b border-[#E2E8F0]">
          {([['today', 'Today'], ['tomorrow', 'Tomorrow'], ['week', 'Next 7 Days'], ['all', 'All']] as [Filter, string][]).map(([v, label]) => (
            <button key={v} onClick={() => setFilter(v)}
              className={cn('px-4 py-1.5 rounded-full text-xs font-medium transition-colors',
                filter === v ? 'bg-[#1A56DB] text-white' : 'bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]'
              )}>
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {groups.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-10 text-center text-sm text-[#94A3B8]">
              No demos in this period.
            </div>
          ) : groups.map(group => (
            <div key={group.label}>
              <h2 className={cn(
                'text-xs font-semibold uppercase tracking-widest mb-3',
                group.label === 'Today' ? 'text-[#1A56DB]' : 'text-[#64748B]'
              )}>
                {group.label} ({group.demos.length})
              </h2>
              <div className="space-y-3">
                {group.demos.map(demo => {
                  const action = actionState[demo.id]
                  const isSaving = saving === demo.id
                  const isExpanded = expanded[demo.id]

                  return (
                    <div key={demo.id} className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div>
                            <p className="font-semibold text-[#0F172A] text-base">{demo.organization?.name}</p>
                            {demo.organization?.location && (
                              <p className="text-xs text-[#94A3B8] mt-0.5">{demo.organization.location}</p>
                            )}
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              <span className="text-sm font-semibold text-[#1A56DB]">🕐 {formatTime(demo.demo_date)}</span>
                              {demo.reminder_sent && (
                                <span className="flex items-center gap-1 text-[10px] text-[#059669] bg-green-50 px-1.5 py-0.5 rounded-full font-medium">
                                  <Bell className="w-2.5 h-2.5" /> SDR reminded org
                                </span>
                              )}
                              {demo.status === 'rescheduled' && (
                                <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Rescheduled</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* SDR Notes */}
                        <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#F1F5F9]">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8]">
                              SDR Context{demo.sdr?.name ? ` — ${demo.sdr.name}` : ''}
                            </p>
                            <button onClick={() => setExpanded(p => ({ ...p, [demo.id]: !p[demo.id] }))}
                              className="text-[10px] text-[#1A56DB] flex items-center gap-0.5">
                              {isExpanded ? 'Less' : 'More'}
                              <ChevronDown className={cn('w-3 h-3 transition-transform', isExpanded && 'rotate-180')} />
                            </button>
                          </div>
                          <p className={cn('text-xs text-[#0F172A]', !isExpanded && 'line-clamp-2')}>
                            {demo.sdr_summary}
                          </p>
                        </div>
                      </div>

                      {/* Action buttons */}
                      {!action ? (
                        <div className="px-4 pb-4 flex gap-2 flex-wrap">
                          <button onClick={() => setActionState(p => ({ ...p, [demo.id]: 'attended' }))}
                            className="flex items-center gap-1.5 px-4 py-2 bg-[#059669] text-white text-xs font-medium rounded-lg hover:bg-[#047857]">
                            <CheckCircle className="w-3.5 h-3.5" /> Demo Attended
                          </button>
                          <button onClick={() => setActionState(p => ({ ...p, [demo.id]: 'no_show' }))}
                            className="flex items-center gap-1.5 px-4 py-2 border border-[#EF4444] text-[#EF4444] text-xs font-medium rounded-lg hover:bg-red-50">
                            <XCircle className="w-3.5 h-3.5" /> No Show
                          </button>
                          <button onClick={() => setActionState(p => ({ ...p, [demo.id]: 'reschedule' }))}
                            className="flex items-center gap-1.5 px-4 py-2 border border-[#E2E8F0] text-[#64748B] text-xs font-medium rounded-lg hover:border-[#1A56DB] hover:text-[#1A56DB]">
                            <RefreshCw className="w-3.5 h-3.5" /> Reschedule
                          </button>
                        </div>

                      ) : action === 'attended' ? (
                        <div className="px-4 pb-4 bg-green-50 py-3 flex items-center justify-between">
                          <p className="text-sm text-green-700 font-medium">✅ Confirm demo attended?</p>
                          <div className="flex gap-2">
                            <button onClick={() => handleDemoAction(demo, 'attended')} disabled={isSaving}
                              className="px-4 py-1.5 bg-[#059669] text-white text-xs font-medium rounded-lg disabled:opacity-60">
                              {isSaving ? 'Saving...' : 'Yes, Attended'}
                            </button>
                            <button onClick={() => setActionState(p => ({ ...p, [demo.id]: null }))} className="px-3 py-1.5 text-xs text-[#64748B]">Cancel</button>
                          </div>
                        </div>

                      ) : action === 'no_show' ? (
                        <div className="px-4 pb-4 bg-red-50 py-3 flex items-center justify-between">
                          <p className="text-sm text-red-700 font-medium">❌ Confirm no show?</p>
                          <div className="flex gap-2">
                            <button onClick={() => handleDemoAction(demo, 'no_show')} disabled={isSaving}
                              className="px-4 py-1.5 bg-[#EF4444] text-white text-xs font-medium rounded-lg disabled:opacity-60">
                              {isSaving ? 'Saving...' : 'Confirm No Show'}
                            </button>
                            <button onClick={() => setActionState(p => ({ ...p, [demo.id]: null }))} className="px-3 py-1.5 text-xs text-[#64748B]">Cancel</button>
                          </div>
                        </div>

                      ) : action === 'reschedule' ? (
                        <div className="px-4 pb-4 pt-2 bg-amber-50 border-t border-amber-100 space-y-3">
                          <p className="text-xs font-semibold text-amber-800">Reschedule Demo</p>

                          {/* New date/time */}
                          <div>
                            <label className="block text-[10px] font-medium text-amber-700 mb-1">New Date & Time <span className="text-red-500">*</span></label>
                            <input
                              type="datetime-local"
                              value={rescheduleDate[demo.id] ?? ''}
                              onChange={e => setRescheduleDate(p => ({ ...p, [demo.id]: e.target.value }))}
                              min={new Date().toISOString().slice(0, 16)}
                              className="w-full px-3 py-1.5 text-xs border border-amber-200 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400/20"
                            />
                          </div>

                          {/* SDR Reassignment (optional) */}
                          <div>
                            <label className="block text-[10px] font-medium text-amber-700 mb-1">
                              Reassign to SDR <span className="text-[10px] text-amber-500 font-normal">(optional — returns lead to SDR workspace)</span>
                            </label>
                            <select
                              value={newSdrId[demo.id] ?? ''}
                              onChange={e => setNewSdrId(p => ({ ...p, [demo.id]: e.target.value }))}
                              className="w-full px-3 py-1.5 text-xs border border-amber-200 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400/20"
                            >
                              <option value="">— Keep current SDR{demo.sdr?.name ? ` (${demo.sdr.name})` : ''} —</option>
                              {sdrs.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </select>
                          </div>

                          {/* Closer Reassignment (optional) */}
                          <div>
                            <label className="block text-[10px] font-medium text-amber-700 mb-1">
                              Reassign to Closer <span className="text-[10px] text-amber-500 font-normal">(optional — moves deal to their pipeline)</span>
                            </label>
                            <select
                              value={newCloserId[demo.id] ?? ''}
                              onChange={e => setNewCloserId(p => ({ ...p, [demo.id]: e.target.value }))}
                              className="w-full px-3 py-1.5 text-xs border border-amber-200 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400/20"
                            >
                              <option value="">— Keep current Closer —</option>
                              {closers.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          </div>

                          {/* Action buttons */}
                          <div className="flex gap-2 items-center pt-1">
                            <button
                              onClick={() => handleReschedule(demo)}
                              disabled={isSaving || !rescheduleDate[demo.id]}
                              className="flex-1 py-2 bg-amber-500 text-white text-xs font-semibold rounded-lg disabled:opacity-60"
                            >
                              {isSaving ? 'Saving...' : 'Confirm Reschedule'}
                            </button>
                            <button
                              onClick={() => setActionState(p => ({ ...p, [demo.id]: null }))}
                              className="px-3 py-2 text-xs text-[#64748B] border border-[#E2E8F0] rounded-lg bg-white"
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
