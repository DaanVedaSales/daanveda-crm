'use client'

import { useState, useEffect } from 'react'
import TopBar from '@/components/layout/TopBar'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/utils'
import { UserPlus, Edit2, Check, X } from 'lucide-react'
import type { User, UserRole } from '@/types/database'

const ROLE_BADGES: Record<UserRole, string> = {
  admin: 'bg-purple-100 text-purple-700',
  sdr: 'bg-blue-100 text-blue-700',
  closer: 'bg-green-100 text-green-700',
  sales_ops: 'bg-slate-100 text-slate-600',
}

export default function TeamPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Partial<User>>({})
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState<UserRole>('sdr')
  const [showInvite, setShowInvite] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    fetchUsers()
  }, [])

  async function fetchUsers() {
    const { data } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: true })
    setUsers(data ?? [])
    setLoading(false)
  }

  function startEdit(user: User) {
    setEditingId(user.id)
    setEditValues({
      name: user.name,
      role: user.role,
      phone: user.phone ?? '',
      monthly_demo_target: user.monthly_demo_target,
      monthly_revenue_target: user.monthly_revenue_target,
    })
  }

  async function saveEdit(userId: string) {
    setSaving(true)
    const res = await fetch(`/api/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editValues),
    })
    if (res.ok) {
      await fetchUsers()
      setEditingId(null)
    } else {
      const data = await res.json()
      setError(data.error ?? 'Failed to save')
    }
    setSaving(false)
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail, name: inviteName, role: inviteRole }),
    })
    if (res.ok) {
      setShowInvite(false)
      setInviteEmail('')
      setInviteName('')
      await fetchUsers()
    } else {
      const data = await res.json()
      setError(data.error ?? 'Failed to invite')
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#1A56DB] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title="Team Management" subtitle="Manage roles, targets & salaries" />

      <div className="flex-1 p-6 space-y-5">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-[#64748B]">{users.filter(u => u.is_active).length} active members</p>
          </div>
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#1A56DB] text-white text-sm font-medium rounded-lg hover:bg-[#1A4FBF] transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Invite Member
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600">
            {error}
            <button onClick={() => setError(null)} className="ml-2 text-red-400 hover:text-red-600"><X className="w-3.5 h-3.5 inline" /></button>
          </div>
        )}

        {/* Invite form */}
        {showInvite && (
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-[#0F172A] mb-4">Invite New Member</h3>
            <form onSubmit={handleInvite} className="grid grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#64748B] mb-1">Full Name</label>
                <input
                  value={inviteName}
                  onChange={e => setInviteName(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20 focus:border-[#1A56DB]"
                  placeholder="Ravi Kumar"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#64748B] mb-1">Email</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20 focus:border-[#1A56DB]"
                  placeholder="ravi@daanveda.com"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#64748B] mb-1">Role</label>
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20"
                >
                  <option value="sdr">SDR</option>
                  <option value="closer">Closer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex items-end gap-2">
                <button type="submit" disabled={saving}
                  className="flex-1 py-2 bg-[#1A56DB] text-white text-sm font-medium rounded-lg hover:bg-[#1A4FBF] disabled:opacity-60 transition-colors">
                  {saving ? 'Sending...' : 'Send Invite'}
                </button>
                <button type="button" onClick={() => setShowInvite(false)}
                  className="py-2 px-3 text-sm border border-[#E2E8F0] text-[#64748B] rounded-lg hover:bg-[#F8FAFC]">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Team table */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F1F5F9]">
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Member</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Role</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Demo Target/mo</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Revenue Target/mo</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Joined</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {users.map(user => (
                <tr key={user.id} className="hover:bg-[#F8FAFC] transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#1A56DB]/10 flex items-center justify-center">
                        <span className="text-[#1A56DB] text-xs font-semibold">{user.name.charAt(0).toUpperCase()}</span>
                      </div>
                      <div>
                        {editingId === user.id ? (
                          <input
                            value={editValues.name ?? ''}
                            onChange={e => setEditValues(v => ({ ...v, name: e.target.value }))}
                            className="px-2 py-1 text-sm border border-[#1A56DB] rounded focus:outline-none w-36"
                          />
                        ) : (
                          <p className="font-medium text-[#0F172A]">{user.name}</p>
                        )}
                        <p className="text-xs text-[#94A3B8]">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    {editingId === user.id ? (
                      <select
                        value={editValues.role ?? user.role}
                        onChange={e => setEditValues(v => ({ ...v, role: e.target.value as UserRole }))}
                        className="px-2 py-1 text-sm border border-[#1A56DB] rounded focus:outline-none"
                      >
                        <option value="sdr">SDR</option>
                        <option value="closer">Closer</option>
                        <option value="admin">Admin</option>
                        <option value="sales_ops">Sales Ops</option>
                      </select>
                    ) : (
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGES[user.role]}`}>
                        {user.role.toUpperCase()}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    {editingId === user.id ? (
                      <input
                        type="number"
                        value={editValues.monthly_demo_target ?? 0}
                        onChange={e => setEditValues(v => ({ ...v, monthly_demo_target: Number(e.target.value) }))}
                        className="px-2 py-1 text-sm border border-[#1A56DB] rounded focus:outline-none w-20"
                      />
                    ) : (
                      <span className="text-[#0F172A]">{user.monthly_demo_target} demos</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    {editingId === user.id ? (
                      <input
                        type="number"
                        value={editValues.monthly_revenue_target ?? 0}
                        onChange={e => setEditValues(v => ({ ...v, monthly_revenue_target: Number(e.target.value) }))}
                        className="px-2 py-1 text-sm border border-[#1A56DB] rounded focus:outline-none w-28"
                      />
                    ) : (
                      <span className="text-[#0F172A]">{formatCurrency(user.monthly_revenue_target)}</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-[#64748B] text-xs">{formatDate(user.created_at)}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      user.is_active ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-500'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${user.is_active ? 'bg-green-500' : 'bg-slate-400'}`} />
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    {editingId === user.id ? (
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => saveEdit(user.id)} disabled={saving}
                          className="p-1.5 bg-[#059669] text-white rounded hover:bg-[#047857] disabled:opacity-60 transition-colors">
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setEditingId(null)}
                          className="p-1.5 bg-slate-100 text-[#64748B] rounded hover:bg-slate-200 transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => startEdit(user)}
                        className="p-1.5 text-[#64748B] hover:text-[#1A56DB] hover:bg-[#F8FAFC] rounded transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
