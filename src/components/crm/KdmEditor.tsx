'use client'

import { useState } from 'react'

// Shared KDM (contact) editor — lists every KDM on the org, lets the user edit any
// of them, add a new one, and set which one is primary. Used by SDR My Leads
// (Contacts tab) and SDR Follow-ups (expanded card). Reuses the existing contacts
// API: PATCH /api/contacts/[id], POST /api/contacts, POST /api/contacts/[id]/set-primary.
// onChanged() should re-fetch the contacts (and the parent list) after any save.

export interface KdmContact {
  id: string
  name: string | null
  designation: string | null
  phone: string | null
  email: string | null
  linkedin_url: string | null
  is_primary: boolean
}

interface KdmEditorProps {
  orgId: string
  contacts: KdmContact[]
  onChanged: () => void
}

interface FormState {
  name: string
  designation: string
  phone: string
  email: string
  linkedin_url: string
}

const EMPTY_FORM: FormState = { name: '', designation: '', phone: '', email: '', linkedin_url: '' }

const inputCls = 'w-full px-2.5 py-1.5 text-xs border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20 focus:border-[#1A56DB]'

export default function KdmEditor({ orgId, contacts, onChanged }: KdmEditorProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [adding, setAdding] = useState(false)
  const [addForm, setAddForm] = useState<FormState>(EMPTY_FORM)
  const [busyId, setBusyId] = useState<string | null>(null)  // 'add' | contact id
  const [error, setError] = useState<string | null>(null)

  function startEdit(c: KdmContact) {
    setError(null)
    setEditingId(c.id)
    setForm({
      name: c.name ?? '',
      designation: c.designation ?? '',
      phone: c.phone ?? '',
      email: c.email ?? '',
      linkedin_url: c.linkedin_url ?? '',
    })
  }

  async function saveEdit(id: string) {
    if (!form.name.trim()) { setError('Name is required.'); return }
    setBusyId(id)
    setError(null)
    try {
      const res = await fetch(`/api/contacts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          designation: form.designation.trim() || null,
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          linkedin_url: form.linkedin_url.trim() || null,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Save failed')
      setEditingId(null)
      onChanged()
    } catch (e: any) {
      setError(e?.message ?? 'Save failed')
    } finally {
      setBusyId(null)
    }
  }

  async function saveAdd() {
    if (!addForm.name.trim()) { setError('Name is required.'); return }
    setBusyId('add')
    setError(null)
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_id: orgId,
          name: addForm.name.trim(),
          designation: addForm.designation.trim() || null,
          phone: addForm.phone.trim() || null,
          email: addForm.email.trim() || null,
          linkedin_url: addForm.linkedin_url.trim() || null,
          // First contact on an org becomes primary automatically.
          is_primary: contacts.length === 0,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Add failed')
      setAdding(false)
      setAddForm(EMPTY_FORM)
      onChanged()
    } catch (e: any) {
      setError(e?.message ?? 'Add failed')
    } finally {
      setBusyId(null)
    }
  }

  async function makePrimary(id: string) {
    setBusyId(id)
    setError(null)
    try {
      const res = await fetch(`/api/contacts/${id}/set-primary`, { method: 'POST' })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Could not set primary')
      onChanged()
    } catch (e: any) {
      setError(e?.message ?? 'Could not set primary')
    } finally {
      setBusyId(null)
    }
  }

  function FormFields({ value, onChange }: { value: FormState; onChange: (f: FormState) => void }) {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <input className={inputCls} placeholder="Name *" value={value.name} onChange={e => onChange({ ...value, name: e.target.value })} />
          <input className={inputCls} placeholder="Designation" value={value.designation} onChange={e => onChange({ ...value, designation: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input className={inputCls} placeholder="Phone" value={value.phone} onChange={e => onChange({ ...value, phone: e.target.value })} />
          <input className={inputCls} placeholder="Email" value={value.email} onChange={e => onChange({ ...value, email: e.target.value })} />
        </div>
        <input className={inputCls} placeholder="LinkedIn URL" value={value.linkedin_url} onChange={e => onChange({ ...value, linkedin_url: e.target.value })} />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {contacts.length === 0 && !adding && (
        <p className="text-xs text-[#94A3B8]">No KDMs on record.</p>
      )}

      {contacts.map(c => (
        <div key={c.id} className="bg-[#F8FAFC] rounded-lg p-3 border border-[#E2E8F0]">
          {editingId === c.id ? (
            <div className="space-y-2">
              <FormFields value={form} onChange={setForm} />
              <div className="flex gap-2">
                <button
                  onClick={() => saveEdit(c.id)}
                  disabled={busyId === c.id}
                  className="px-3 py-1.5 bg-[#1A56DB] text-white text-[11px] font-semibold rounded-lg hover:bg-[#1e40af] disabled:opacity-60 transition-colors"
                >
                  {busyId === c.id ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => { setEditingId(null); setError(null) }}
                  className="px-3 py-1.5 border border-[#E2E8F0] text-[#64748B] text-[11px] rounded-lg hover:bg-[#F1F5F9]"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <p className="text-sm font-medium text-[#0F172A] truncate">{c.name}</p>
                  {c.is_primary && <span className="shrink-0 text-[10px] bg-[#1A56DB] text-white px-1.5 py-0.5 rounded-full">PRIMARY</span>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!c.is_primary && (
                    <button
                      onClick={() => makePrimary(c.id)}
                      disabled={busyId === c.id}
                      className="text-[11px] text-[#1A56DB] hover:underline disabled:opacity-60"
                    >
                      {busyId === c.id ? '…' : 'Set primary'}
                    </button>
                  )}
                  <button onClick={() => startEdit(c)} className="text-[11px] text-[#64748B] hover:text-[#0F172A]">Edit</button>
                </div>
              </div>
              {c.designation && <p className="text-xs text-[#64748B] mt-0.5">{c.designation}</p>}
              <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-[#94A3B8]">
                {c.phone && <span>{c.phone}</span>}
                {c.email && <span>{c.email}</span>}
                {c.linkedin_url && (
                  <a href={c.linkedin_url} target="_blank" rel="noreferrer" className="text-[#1A56DB] hover:underline">LinkedIn</a>
                )}
              </div>
            </div>
          )}
        </div>
      ))}

      {adding ? (
        <div className="bg-[#F8FAFC] rounded-lg p-3 border border-[#E2E8F0] space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8]">New KDM</p>
          <FormFields value={addForm} onChange={setAddForm} />
          <div className="flex gap-2">
            <button
              onClick={saveAdd}
              disabled={busyId === 'add'}
              className="px-3 py-1.5 bg-[#1A56DB] text-white text-[11px] font-semibold rounded-lg hover:bg-[#1e40af] disabled:opacity-60 transition-colors"
            >
              {busyId === 'add' ? 'Adding…' : 'Add KDM'}
            </button>
            <button
              onClick={() => { setAdding(false); setAddForm(EMPTY_FORM); setError(null) }}
              className="px-3 py-1.5 border border-[#E2E8F0] text-[#64748B] text-[11px] rounded-lg hover:bg-[#F1F5F9]"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => { setAdding(true); setError(null) }}
          className="w-full py-2 border border-dashed border-[#E2E8F0] text-[11px] text-[#64748B] rounded-lg hover:border-[#1A56DB] hover:text-[#1A56DB] transition-colors"
        >
          + Add KDM
        </button>
      )}

      {error && <p className="text-[11px] text-[#EF4444]">{error}</p>}
    </div>
  )
}
