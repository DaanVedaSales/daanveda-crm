'use client'

import { useState, useEffect } from 'react'
import TopBar from '@/components/layout/TopBar'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { CheckCircle, XCircle, RefreshCw, ChevronDown } from 'lucide-react'

interface DemoWithDetails {
  id: string
  demo_date: string
  status: string
  sdr_summary: string
  post_demo_notes: string | null
  organization: { name: string; location: string | null }
  sdr: { name: string } | null
  lead: { id: string; org_id: string } | null
}

interface FollowupDeal {
  id: string
  stage: string
  next_follow_up: string | null
  organization: { name: string } | null
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export default function TodayPage() {
  const [demos, setDemos] = useState<DemoWithDetails[]>([])
  const [followups, setFollowups] = useState<FollowupDeal[]>([])
  const [loading, setLoading] = useState(true)
  const [actionState, setActionState] = useState<Record<string, 'attended' | 'no_show' | 'reschedule' | null>>({})
  const [rescheduleDate, setRescheduleDate] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({})
  const supabase = createClient()

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const { data: user } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('users').select('id').eq('auth_id', user.user!.id).single()
    if (!profile) return

    const today = new Date().toISOString().split('T')[0]

    const [demosRes, followupsRes] = await Promise.all([
      supabase.from('demos')
        .select(`
          id, demo_date, status, sdr_summary, post_demo_notes,
          organization:organizations(name, location),
          sdr:users!demos_sdr_id_fkey(name),
          lead:leads(id, org_id)
        `)
        .eq('closer_id', profile.id)
        .gte('demo_date', `${today}T00:00:00`)
        .lte('demo_date', `${today}T23:59:59`)
        .in('status', ['scheduled', 'rescheduled'])
        .order('demo_date', { ascending: true }),
      supabase.from('deals')
        .select('id, stage, next_follow_up, organization:organizations(name)')
        .eq('closer_id', profile.id)
        .lte('next_follow_up', today)
        .not('stage', 'in', '("won","lost","ghosted","converted")')
        .order('next_follow_up', { ascending: true }),
    ])

    setDemos((demosRes.data ?? []) as unknown as DemoWithDetails[])
    setFollowups((followupsRes.data ?? []) as unknown as FollowupDeal[])
    setLoading(false)
  }

  async function handleDemoAction(demo: DemoWithDetails, action: 'attended' | 'no_show') {
    setSaving(demo.id)
    const res = await fetch(`/api/demos/${demo.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: action }),
    })
    if (res.ok) {
      // Remove from today's list
      setDemos(prev => prev.filter(d => d.id !== demo.id))
    }
    setSaving(null)
  }

  async function handleReschedule(demo: DemoWithDetails) {
    const newDate = rescheduleDate[demo.id]
    if (!newDate) return alert('Please select a new date and time.')
    setSaving(demo.id)
    const res = await fetch(`/api/demos/${demo.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reschedule_date: newDate }),
    })
    if (res.ok) {
      setDemos(prev => prev.filter(d => d.id !== demo.id))
      setActionState(prev => ({ ...prev, [demo.id]: null }))
    }
    setSaving(null)
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#1A56DB] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const todayLabel = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="flex-1 flex flex-col">
      <TopBar
        title="Today's Actions"
        subtitle={`${todayLabel} · ${demos.length} demo${demos.length !== 1 ? 's' : ''} · ${followups.length} follow-up${followups.length !== 1 ? 's' : ''}`}
      />
      <div className="flex-1 p-6 space-y-6 overflow-y-auto">

        {/* ── TODAY'S DEMOS ── */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-[#64748B] mb-3">
            Today's Demos ({demos.length})
          </h2>

          {demos.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 text-center text-sm text-[#94A3B8]">
              No demos scheduled for today. Check the pipeline for active deals.
            </div>
          ) : (
            <div className="space-y-4">
              {demos.map(demo => {
                const action = actionState[demo.id]
                const isSaving = saving === demo.id
                const notesExpanded = expandedNotes[demo.id]

                return (
                  <div key={demo.id} className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                    {/* Demo header */}
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-[#0F172A] text-base">{demo.organization?.name}</p>
                          {demo.organization?.location && (
                            <p className="text-xs text-[#94A3B8] mt-0.5">{demo.organization.location}</p>
                          )}
                          <p className="text-sm font-semibold text-[#1A56DB] mt-1">
                            🕐 {formatTime(demo.demo_date)}
                          </p>
                        </div>
                        {demo.status === 'rescheduled' && (
                          <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium">
                            Rescheduled
                          </span>
                        )}
                      </div>

                      {/* SDR Summary */}
                      <div className="mt-3 p-3 bg-[#F8FAFC] rounded-lg border border-[#F1F5F9]">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8]">
                            SDR Context — {demo.sdr?.name ?? 'SDR'}
                          </p>
                          <button
                            onClick={() => setExpandedNotes(prev => ({ ...prev, [demo.id]: !prev[demo.id] }))}
                            className="text-[10px] text-[#1A56DB] flex items-center gap-0.5"
                          >
                            {notesExpanded ? 'Less' : 'More'}
                            <ChevronDown className={cn('w-3 h-3 transition-transform', notesExpanded && 'rotate-180')} />
                          </button>
                        </div>
                        <p className={cn('text-xs text-[#0F172A]', !notesExpanded && 'line-clamp-3')}>
                          {demo.sdr_summary}
                        </p>
                      </div>
                    </div>

                    {/* Action buttons */}
                    {action === null || action === undefined ? (
                      <div className="px-4 pb-4 flex gap-2">
                        <button
                          onClick={() => setActionState(prev => ({ ...prev, [demo.id]: 'attended' }))}
                          className="flex items-center gap-1.5 px-4 py-2 bg-[#059669] text-white text-xs font-medium rounded-lg hover:bg-[#047857] transition-colors"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          Demo Attended
                        </button>
                        <button
                          onClick={() => setActionState(prev => ({ ...prev, [demo.id]: 'no_show' }))}
                          className="flex items-center gap-1.5 px-4 py-2 border border-[#EF4444] text-[#EF4444] text-xs font-medium rounded-lg hover:bg-red-50 transition-colors"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          No Show
                        </button>
                        <button
                          onClick={() => setActionState(prev => ({ ...prev, [demo.id]: 'reschedule' }))}
                          className="flex items-center gap-1.5 px-4 py-2 border border-[#E2E8F0] text-[#64748B] text-xs font-medium rounded-lg hover:border-[#1A56DB] hover:text-[#1A56DB] transition-colors"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          Reschedule
                        </button>
                      </div>
                    ) : action === 'attended' ? (
                      <div className="px-4 pb-4 bg-green-50 py-3 flex items-center justify-between">
                        <p className="text-sm text-green-700 font-medium">✅ Mark as attended?</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleDemoAction(demo, 'attended')}
                            disabled={isSaving}
                            className="px-4 py-1.5 bg-[#059669] text-white text-xs font-medium rounded-lg disabled:opacity-60"
                          >
                            {isSaving ? 'Saving...' : 'Confirm Attended'}
                          </button>
                          <button onClick={() => setActionState(prev => ({ ...prev, [demo.id]: null }))} className="px-3 py-1.5 text-xs text-[#64748B]">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : action === 'no_show' ? (
                      <div className="px-4 pb-4 bg-red-50 py-3 flex items-center justify-between">
                        <p className="text-sm text-red-700 font-medium">❌ Mark as no show?</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleDemoAction(demo, 'no_show')}
                            disabled={isSaving}
                            className="px-4 py-1.5 bg-[#EF4444] text-white text-xs font-medium rounded-lg disabled:opacity-60"
                          >
                            {isSaving ? 'Saving...' : 'Confirm No Show'}
                          </button>
                          <button onClick={() => setActionState(prev => ({ ...prev, [demo.id]: null }))} className="px-3 py-1.5 text-xs text-[#64748B]">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : action === 'reschedule' ? (
                      <div className="px-4 pb-4 pt-2 bg-amber-50 space-y-2">
                        <p className="text-xs font-medium text-amber-800">Select new demo date & time</p>
                        <div className="flex gap-2 items-center">
                          <input
                            type="datetime-local"
                            value={rescheduleDate[demo.id] ?? ''}
                            onChange={e => setRescheduleDate(prev => ({ ...prev, [demo.id]: e.target.value }))}
                            min={new Date().toISOString().slice(0, 16)}
                            className="flex-1 px-3 py-1.5 text-xs border border-[#E2E8F0] rounded-lg focus:outline-none"
                          />
                          <button
                            onClick={() => handleReschedule(demo)}
                            disabled={isSaving || !rescheduleDate[demo.id]}
                            className="px-4 py-1.5 bg-amber-500 text-white text-xs font-medium rounded-lg disabled:opacity-60"
                          >
                            {isSaving ? 'Saving...' : 'Confirm'}
                          </button>
                          <button onClick={() => setActionState(prev => ({ ...prev, [demo.id]: null }))} className="px-3 py-1.5 text-xs text-[#64748B]">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── FOLLOW-UPS DUE ── */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-[#64748B] mb-3">
            Follow-ups Due ({followups.length})
          </h2>
          {followups.length === 0 ? (
            <p className="text-sm text-[#94A3B8]">No follow-ups due today.</p>
          ) : (
            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F1F5F9]">
                    <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Organisation</th>
                    <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Stage</th>
                    <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {followups.map((f: any) => (
                    <tr key={f.id} className="hover:bg-[#F8FAFC]">
                      <td className="px-5 py-3 font-medium text-[#0F172A]">{f.organization?.name}</td>
                      <td className="px-5 py-3 text-[#64748B] capitalize">{f.stage?.replace(/_/g, ' ')}</td>
                      <td className="px-5 py-3 text-[#EF4444] font-medium text-xs">{formatDate(f.next_follow_up)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
