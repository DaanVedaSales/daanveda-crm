'use client'

import { useState, useEffect } from 'react'
import { Ban, Plus, X, RotateCcw, MapPin } from 'lucide-react'

interface BannedOrg {
  id: string
  name: string
  location: string | null
  ban_reason: string | null
  created_at: string | null
}

export default function BannedOrgsSection() {
  const [orgs, setOrgs] = useState<BannedOrg[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/organizations/banned')
      if (res.ok) {
        const data = await res.json()
        setOrgs(data.organizations ?? [])
      }
    } catch { /* ignore */ }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function unban(id: string) {
    if (!confirm('Unban this organisation? It will become contactable again across all workspaces.')) return
    const res = await fetch(`/api/organizations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_banned: false, ban_reason: null }),
    })
    if (res.ok) setOrgs(prev => prev.filter(o => o.id !== id))
    else alert('Failed to unban. Please try again.')
  }

  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-[#F1F5F9] flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#FEE2E2] flex items-center justify-center shrink-0">
            <Ban className="w-4 h-4 text-[#DC2626]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#0F172A]">Banned Organizations ({orgs.length})</h2>
            <p className="text-[11px] text-[#94A3B8]">Hidden from SDR &amp; Closer workspaces · flagged red in org search</p>
          </div>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-[#DC2626] text-white text-xs font-semibold rounded-lg hover:bg-[#B91C1C] transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add Banned Organization
        </button>
      </div>

      <div className="max-h-72 overflow-y-auto divide-y divide-[#F1F5F9]">
        {loading ? (
          <div className="px-5 py-6 text-center text-[12px] text-[#94A3B8]">Loading…</div>
        ) : orgs.length === 0 ? (
          <div className="px-5 py-6 text-center text-[12px] text-[#94A3B8]">No banned organisations yet.</div>
        ) : orgs.map(o => (
          <div key={o.id} className="px-5 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-[#0F172A] truncate">{o.name}</p>
              <div className="flex flex-wrap items-center gap-x-3 text-[11px] text-[#94A3B8]">
                {o.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{o.location}</span>}
                {o.ban_reason && <span className="italic truncate">{o.ban_reason}</span>}
              </div>
            </div>
            <button
              onClick={() => unban(o.id)}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-[#64748B] border border-[#E2E8F0] rounded-lg hover:bg-[#F8FAFC] transition-colors shrink-0"
            >
              <RotateCcw className="w-3 h-3" /> Unban
            </button>
          </div>
        ))}
      </div>

      {showAdd && <AddBannedModal onClose={() => setShowAdd(false)} onAdded={() => { setShowAdd(false); load() }} />}
    </div>
  )
}

function AddBannedModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [form, setForm] = useState({ name: '', location: '', url: '', linkedin_url: '', ban_reason: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }))
  }

  const canSubmit = form.name.trim().length > 0 && form.location.trim().length > 0

  async function submit() {
    if (!canSubmit) return
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/organizations/banned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          location: form.location.trim(),
          url: form.url.trim() || undefined,
          linkedin_url: form.linkedin_url.trim() || undefined,
          ban_reason: form.ban_reason.trim() || undefined,
        }),
      })
      if (res.ok) onAdded()
      else { const d = await res.json().catch(() => ({})); setError(d.error ?? 'Failed to add'); setSaving(false) }
    } catch { setError('Network error — try again'); setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Ban className="w-4 h-4 text-[#DC2626]" />
            <h3 className="font-semibold text-[#0F172A]">Add Banned Organization</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#94A3B8]"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-[11px] text-[#94A3B8] mb-4">This org will be hidden from all SDR &amp; Closer workspaces and flagged red in org search. No lead or pipeline entry is created.</p>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-[#374151] mb-1">Name <span className="text-red-500">*</span></label>
              <input value={form.name} onChange={set('name')} placeholder="Organisation name" className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[#374151] mb-1">City <span className="text-red-500">*</span></label>
              <input value={form.location} onChange={set('location')} placeholder="e.g. Mumbai" className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20" />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[#374151] mb-1">Website <span className="text-[#CBD5E1] font-normal">(optional)</span></label>
            <input value={form.url} onChange={set('url')} placeholder="www.example.org" className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20" />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[#374151] mb-1">LinkedIn <span className="text-[#CBD5E1] font-normal">(optional)</span></label>
            <input value={form.linkedin_url} onChange={set('linkedin_url')} placeholder="linkedin.com/company/…" className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20" />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[#374151] mb-1">Reason <span className="text-[#CBD5E1] font-normal">(optional)</span></label>
            <textarea value={form.ban_reason} onChange={set('ban_reason')} rows={2} placeholder="Why is this org banned?" className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20 resize-none" />
          </div>
          {error && <p className="text-[11px] text-red-500">{error}</p>}
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={submit} disabled={!canSubmit || saving} className="flex-1 py-2.5 bg-[#DC2626] text-white text-sm font-semibold rounded-xl hover:bg-[#B91C1C] disabled:opacity-40 transition-colors">
            {saving ? 'Adding…' : 'Add Banned Organization'}
          </button>
          <button onClick={onClose} className="px-5 py-2.5 text-sm text-[#64748B] border border-[#E2E8F0] rounded-xl hover:bg-[#F8FAFC] transition-colors">Cancel</button>
        </div>
      </div>
    </div>
  )
}
