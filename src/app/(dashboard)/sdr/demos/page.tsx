'use client'

import { useState, useEffect } from 'react'
import TopBar from '@/components/layout/TopBar'
import { createClient } from '@/lib/supabase/client'
import { cn, formatIST } from '@/lib/utils'
import { Bell, BellOff, Clock, CalendarCheck, AlertCircle, ChevronDown, ChevronUp, Trash2, Pencil } from 'lucide-react'
import DateTimePicker from '@/components/ui/DateTimePicker'

interface BookedDemo {
  id: string
  demo_date: string
  status: string
  sdr_summary: string | null
  pain_point: string | null
  demo_expectation: string | null
  reminder_sent: boolean | null
  created_at: string
  lead_id: string | null
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
  return formatIST(dateStr, {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

export default function SDRDemosPage() {
  const [demos, setDemos] = useState<BookedDemo[]>([])
  const [loading, setLoading] = useState(true)
  const [reminding, setReminding] = useState<string | null>(null)
  const supabase = createClient()

  function deleteDemoFromList(leadId: string) {
    setDemos(prev => prev.filter(d => d.lead_id !== leadId))
  }

  useEffect(() => { fetchDemos() }, [])

  async function fetchDemos() {
    const { data: user } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('users').select('id').eq('auth_id', user.user!.id).single()
    if (!profile) return

    const { data } = await supabase
      .from('demos')
      .select(`
        id, demo_date, status, sdr_summary, pain_point, demo_expectation, reminder_sent, created_at, lead_id,
        organization:organizations(name, location, url, is_banned),
        closer:users!demos_closer_id_fkey(name)
      `)
      .eq('sdr_id', profile.id)
      .eq('is_deleted', false)
      .in('status', ['scheduled', 'rescheduled'])
      .order('demo_date', { ascending: true })

    // Hide demos whose organisation has been banned (do-not-contact)
    setDemos(((data ?? []) as unknown as BookedDemo[]).filter(d => !(d as any).organization?.is_banned))
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
      <div className="flex-1 flex flex-col bg-[#F8FAFC]">
        <TopBar title="My Demos" subtitle="Loading..." />
        <div className="flex-1 p-6 space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-[#E2E8F0] p-5 space-y-3" style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.06)' }}>
              <div className="h-4 w-36 bg-[#F1F5F9] rounded skeleton" />
              <div className="h-3 w-24 bg-[#F1F5F9] rounded skeleton" />
              <div className="h-12 bg-[#F8FAFC] rounded-xl skeleton mt-2" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-[#F8FAFC]">
      <TopBar
        title="My Demos"
        subtitle={`${demos.length} upcoming${needsReminder.length > 0 ? ` · ${needsReminder.length} reminder${needsReminder.length > 1 ? 's' : ''} due` : ''}`}
      />

      <div className="flex-1 p-6 space-y-6 overflow-y-auto">

        {/* Reminder alert banner */}
        {needsReminder.length > 0 && (
          <div className="flex items-start gap-3 p-4 bg-[#FFFBEB] border border-[#FDE68A] rounded-2xl">
            <AlertCircle className="w-4 h-4 text-[#B45309] shrink-0 mt-0.5" strokeWidth={2} />
            <div>
              <p className="text-[13px] font-semibold text-[#92400E]">
                {needsReminder.length} demo{needsReminder.length > 1 ? 's' : ''} need{needsReminder.length === 1 ? 's' : ''} a reminder today
              </p>
              <p className="text-[12px] text-[#B45309] mt-0.5">
                Reach out to the org before their demo — a quick call or message keeps the show rate high.
              </p>
            </div>
          </div>
        )}

        {demos.length === 0 && (
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-12 text-center" style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.06)' }}>
            <div className="w-10 h-10 rounded-xl bg-[#F1F5F9] flex items-center justify-center mx-auto mb-3">
              <CalendarCheck className="w-5 h-5 text-[#94A3B8]" strokeWidth={1.5} />
            </div>
            <p className="text-[13px] font-medium text-[#374151]">No booked demos yet</p>
            <p className="text-[11px] text-[#94A3B8] mt-1">Demos you book will appear here with reminder tracking.</p>
          </div>
        )}

        {overdueDemos.length > 0 && (
          <DemoSection title="Overdue" demos={overdueDemos} onRemind={markReminder} reminding={reminding} onDelete={deleteDemoFromList} onDemoUpdated={fetchDemos} urgent />
        )}
        {todayDemos.length > 0 && (
          <DemoSection title="Today" demos={todayDemos} onRemind={markReminder} reminding={reminding} onDelete={deleteDemoFromList} onDemoUpdated={fetchDemos} urgent />
        )}
        {tomorrowDemos.length > 0 && (
          <DemoSection title="Tomorrow" demos={tomorrowDemos} onRemind={markReminder} reminding={reminding} onDelete={deleteDemoFromList} onDemoUpdated={fetchDemos} urgent />
        )}
        {thisWeekDemos.length > 0 && (
          <DemoSection title="This Week" demos={thisWeekDemos} onRemind={markReminder} reminding={reminding} onDelete={deleteDemoFromList} onDemoUpdated={fetchDemos} />
        )}
        {upcomingDemos.length > 0 && (
          <DemoSection title="Upcoming" demos={upcomingDemos} onRemind={markReminder} reminding={reminding} onDelete={deleteDemoFromList} onDemoUpdated={fetchDemos} />
        )}

      </div>
    </div>
  )
}

function DemoSection({
  title, demos, onRemind, reminding, onDelete, onDemoUpdated, urgent = false
}: {
  title: string
  demos: BookedDemo[]
  onRemind: (id: string) => void
  reminding: string | null
  onDelete: (leadId: string) => void
  onDemoUpdated: () => void
  urgent?: boolean
}) {
  return (
    <div>
      <h2
        className="text-label mb-3"
        style={{ color: urgent ? '#B45309' : '#94A3B8' }}
      >
        {title} &middot; {demos.length}
      </h2>
      <div className="space-y-3">
        {demos.map(demo => <DemoCard key={demo.id} demo={demo} onRemind={onRemind} reminding={reminding} onDelete={onDelete} onDemoUpdated={onDemoUpdated} />)}
      </div>
    </div>
  )
}

// ── Expanded detail for a demo card ──────────────────────────────────────────
function DemoExpandedDetail({ demo }: { demo: BookedDemo }) {
  const [leadDetail, setLeadDetail] = useState<{ contacts: any[]; activities: any[] } | null>(null)

  useEffect(() => {
    if (!demo.lead_id) return
    fetch(`/api/leads/${demo.lead_id}`)
      .then(r => r.json())
      .then(d => setLeadDetail({ contacts: d.contacts ?? [], activities: d.activities ?? [] }))
  }, [demo.lead_id])

  return (
    <div className="mt-4 space-y-3 border-t border-[#F1F5F9] pt-4">
      {/* Pain point + demo expectation */}
      {(demo.pain_point || demo.demo_expectation) && (
        <div className="space-y-2 bg-[#F8FAFC] rounded-xl p-3 border border-[#F1F5F9]">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8]">Context for Closer</p>
          {demo.pain_point && (
            <div>
              <p className="text-[10px] font-medium text-[#64748B] mb-0.5">Pain Point</p>
              <p className="text-xs text-[#0F172A] leading-relaxed">{demo.pain_point}</p>
            </div>
          )}
          {demo.demo_expectation && (
            <div>
              <p className="text-[10px] font-medium text-[#64748B] mb-0.5">Demo Expectation</p>
              <p className="text-xs text-[#0F172A] leading-relaxed">{demo.demo_expectation}</p>
            </div>
          )}
        </div>
      )}

      {/* All KDM Contacts */}
      {!leadDetail && demo.lead_id && (
        <div className="h-12 bg-[#F1F5F9] rounded-lg skeleton" />
      )}
      {leadDetail && leadDetail.contacts.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8]">Key Decision Makers</p>
          {leadDetail.contacts.map((c: any) => (
            <div key={c.id} className="bg-[#F8FAFC] rounded-xl p-3 border border-[#E2E8F0]">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-sm font-medium text-[#0F172A]">{c.name}</p>
                {c.is_primary && (
                  <span className="text-[9px] font-semibold bg-[#1A56DB] text-white px-1.5 py-0.5 rounded-full">Primary</span>
                )}
              </div>
              {c.designation && <p className="text-xs text-[#64748B]">{c.designation}</p>}
              <div className="flex gap-3 mt-1 text-xs text-[#64748B]">
                {c.phone && <span>{c.phone}</span>}
                {c.email && <span>{c.email}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Activity log */}
      {leadDetail && leadDetail.activities.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8] mb-2">Recent Activity</p>
          <div className="space-y-2 max-h-36 overflow-y-auto">
            {leadDetail.activities.slice(0, 5).map((a: any) => (
              <div key={a.id} className="flex gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#1A56DB] mt-1.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-[#0F172A] capitalize">{a.activity_type.replace('_', ' ')}{a.channel ? ` · ${a.channel}` : ''}</p>
                  <p className="text-xs text-[#64748B]">{a.notes}</p>
                  <p className="text-[10px] text-[#94A3B8]">{new Date(a.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function DemoCard({ demo, onRemind, reminding, onDelete, onDemoUpdated }: {
  demo: BookedDemo
  onRemind: (id: string) => void
  reminding: string | null
  onDelete: (leadId: string) => void
  onDemoUpdated: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const days = daysUntil(demo.demo_date)

  async function handleDelete() {
    if (!demo.lead_id) return
    setDeleting(true)
    const res = await fetch(`/api/leads/${demo.lead_id}`, { method: 'DELETE' })
    if (res.ok) onDelete(demo.lead_id)
    setDeleting(false)
    setConfirmDelete(false)
  }
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
    <div
      className={cn(
        'bg-white rounded-2xl border p-5',
        isOverdue ? 'border-red-200' : isUrgent ? 'border-amber-200' : 'border-[#E2E8F0]'
      )}
      style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.06)' }}
    >
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

        {/* Right: reminder button + expand toggle */}
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

          {/* Edit button */}
          {!confirmDelete && (
            <button
              onClick={() => setShowEdit(true)}
              className="flex items-center gap-1 text-[10px] text-[#94A3B8] hover:text-[#1A56DB] transition-colors"
              title="Edit demo"
            >
              <Pencil className="w-3 h-3" />
            </button>
          )}

          {/* Delete button / inline confirmation */}
          {confirmDelete ? (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-[#EF4444] font-medium">Delete this demo?</span>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-2 py-0.5 bg-[#EF4444] text-white rounded text-[10px] font-semibold disabled:opacity-60 hover:bg-[#DC2626]"
              >
                {deleting ? '...' : 'Yes'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-2 py-0.5 border border-[#E2E8F0] text-[#64748B] rounded text-[10px] hover:bg-[#F8FAFC]"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1 text-[10px] text-[#94A3B8] hover:text-[#EF4444] transition-colors"
              title="Delete demo"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}

          <button
            onClick={() => setExpanded(prev => !prev)}
            className="flex items-center gap-1 text-[10px] text-[#94A3B8] hover:text-[#64748B] transition-colors"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? 'Less' : 'Details'}
          </button>
          <p className="text-[10px] text-[#94A3B8]">
            Booked {new Date(demo.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          </p>
        </div>
      </div>

      {/* SDR Summary snippet (collapsed view) */}
      {!expanded && demo.sdr_summary && (
        <div className="mt-4 p-3.5 bg-[#F8FAFC] rounded-xl border border-[#F1F5F9]">
          <p className="text-label text-[#94A3B8] mb-1.5">Your Summary for Closer</p>
          <p className="text-[12px] text-[#64748B] leading-relaxed line-clamp-2">{demo.sdr_summary}</p>
        </div>
      )}

      {/* Expanded detail: pain point, demo expectation, KDM contact, activity log */}
      {expanded && <DemoExpandedDetail demo={demo} />}

      {/* Edit Demo Modal */}
      {showEdit && (
        <EditDemoModal
          demo={demo}
          onClose={() => setShowEdit(false)}
          onSuccess={() => { setShowEdit(false); onDemoUpdated() }}
        />
      )}
    </div>
  )
}

// ── Edit Demo Modal ───────────────────────────────────────────────────────────
// Allows SDR to reschedule the demo and edit KDM contact details
function EditDemoModal({ demo, onClose, onSuccess }: {
  demo: BookedDemo
  onClose: () => void
  onSuccess: () => void
}) {
  const [demoDate, setDemoDate] = useState(demo.demo_date)
  const [contacts, setContacts] = useState<any[]>([])
  const [loadingContacts, setLoadingContacts] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Contact edit state — indexed by contact id
  const [contactEdits, setContactEdits] = useState<Record<string, { name: string; designation: string; phone: string; email: string }>>({})

  useEffect(() => {
    if (!demo.lead_id) { setLoadingContacts(false); return }
    fetch(`/api/leads/${demo.lead_id}`)
      .then(r => r.json())
      .then(d => {
        const ctcs = d.contacts ?? []
        setContacts(ctcs)
        // Pre-fill edit state for each contact
        const edits: Record<string, any> = {}
        ctcs.forEach((c: any) => {
          edits[c.id] = { name: c.name ?? '', designation: c.designation ?? '', phone: c.phone ?? '', email: c.email ?? '' }
        })
        setContactEdits(edits)
        setLoadingContacts(false)
      })
  }, [demo.lead_id])

  function updateContactField(contactId: string, field: string, value: string) {
    setContactEdits(prev => ({ ...prev, [contactId]: { ...prev[contactId], [field]: value } }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)

    const tasks: Promise<any>[] = []

    // Reschedule demo if date changed
    if (demoDate !== demo.demo_date) {
      tasks.push(
        fetch(`/api/demos/${demo.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reschedule_date: demoDate }),
        })
      )
    }

    // Update each contact if changed
    for (const c of contacts) {
      const edit = contactEdits[c.id]
      if (!edit) continue
      const changed =
        edit.name !== (c.name ?? '') ||
        edit.designation !== (c.designation ?? '') ||
        edit.phone !== (c.phone ?? '') ||
        edit.email !== (c.email ?? '')
      if (changed) {
        tasks.push(
          fetch(`/api/contacts/${c.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: edit.name.trim(),
              designation: edit.designation.trim() || null,
              phone: edit.phone.trim() || null,
              email: edit.email.trim() || null,
            }),
          })
        )
      }
    }

    if (tasks.length === 0) { setSaving(false); onClose(); return }

    const results = await Promise.all(tasks)
    const failed = results.find(r => !r.ok)
    if (failed) {
      const d = await failed.json()
      setError(d.error ?? 'Save failed')
      setSaving(false)
      return
    }

    setSaving(false)
    onSuccess()
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20 focus:border-[#1A56DB]'

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="font-semibold text-[#0F172A] text-base">Edit Demo</h3>
            <p className="text-xs text-[#64748B] mt-0.5">{demo.organization?.name}</p>
          </div>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#64748B] text-xl leading-none">×</button>
        </div>

        <form onSubmit={submit} className="space-y-5">

          {/* Demo date/time */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#64748B] mb-1.5">
              Demo Date &amp; Time
            </label>
            <DateTimePicker value={demoDate} onChange={setDemoDate} placeholder="Pick demo date & time" />
          </div>

          {/* KDM contacts */}
          {!loadingContacts && contacts.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-[#F1F5F9]">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8]">Key Decision Makers</p>
              {contacts.map((c: any, idx: number) => (
                <div key={c.id} className="space-y-2.5 p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                  <p className="text-[10px] font-semibold text-[#64748B]">
                    {c.is_primary ? 'Primary KDM' : `KDM ${idx + 1}`}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-[#64748B] mb-1">Name</label>
                      <input
                        value={contactEdits[c.id]?.name ?? ''}
                        onChange={e => updateContactField(c.id, 'name', e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#64748B] mb-1">Designation</label>
                      <input
                        value={contactEdits[c.id]?.designation ?? ''}
                        onChange={e => updateContactField(c.id, 'designation', e.target.value)}
                        placeholder="CEO, CFO..."
                        className={inputCls}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-[#64748B] mb-1">Phone</label>
                      <input
                        value={contactEdits[c.id]?.phone ?? ''}
                        onChange={e => updateContactField(c.id, 'phone', e.target.value)}
                        placeholder="+91 98765 43210"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#64748B] mb-1">Email</label>
                      <input
                        type="email"
                        value={contactEdits[c.id]?.email ?? ''}
                        onChange={e => updateContactField(c.id, 'email', e.target.value)}
                        placeholder="name@org.com"
                        className={inputCls}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {loadingContacts && (
            <div className="h-20 bg-[#F1F5F9] rounded-xl skeleton" />
          )}

          {error && <p className="text-xs text-[#EF4444]">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 bg-[#1A56DB] text-white text-sm font-medium rounded-xl hover:bg-[#1e40af] disabled:opacity-60 transition-colors"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 border border-[#E2E8F0] text-sm text-[#64748B] rounded-xl hover:bg-[#F8FAFC]"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
