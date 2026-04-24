'use client'

import { useState, useEffect } from 'react'
import TopBar from '@/components/layout/TopBar'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/utils'
import { UserPlus, Edit2, Check, X, AlertCircle, TrendingUp } from 'lucide-react'

type TeamUser = {
  id: string
  name: string
  email: string
  role: string
  phone: string | null
  monthly_demo_target: number | null
  monthly_revenue_target: number | null
  monthly_base_salary: number | null
  is_active: boolean | null
  created_at: string | null
}

type UserPerf = {
  user_id: string
  role: string
  demos_this_month: number
  revenue_this_month: number
  achievement_pct: number
  multiplier: number
  est_incentive: number
  base_salary: number
  total_payout: number
}

const ROLE_BADGES: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700',
  sdr: 'bg-blue-100 text-blue-700',
  closer: 'bg-green-100 text-green-700',
  sales_ops: 'bg-slate-100 text-slate-600',
}

export default function TeamPage() {
  const [users, setUsers] = useState<TeamUser[]>([])
  const [perf, setPerf] = useState<Record<string, UserPerf>>({})
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Partial<TeamUser>>({})
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState('sdr')
  const [showInvite, setShowInvite] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const [usersRes, perfRes] = await Promise.all([
      supabase
        .from('users')
        .select('id, name, email, role, phone, monthly_demo_target, monthly_revenue_target, monthly_base_salary, is_active, created_at')
        .order('created_at', { ascending: true }),
      fetch('/api/team/performance').then(r => r.json()),
    ])
    setUsers((usersRes.data as TeamUser[]) ?? [])
    const perfMap: Record<string, UserPerf> = {}
    ;((perfRes as UserPerf[]) ?? []).forEach(p => { perfMap[p.user_id] = p })
    setPerf(perfMap)
    setLoading(false)
  }

  function startEdit(user: TeamUser) {
    setEditingId(user.id)
    setEditValues({
      name: user.name,
      role: user.role,
      phone: user.phone ?? '',
      monthly_demo_target: user.monthly_demo_target ?? 0,
      monthly_revenue_target: user.monthly_revenue_target ?? 0,
      monthly_base_salary: user.monthly_base_salary ?? 0,
      is_active: user.is_active ?? true,
    })
  }

  async function saveEdit(userId: string) {
    setSaving(true)
    setError(null)
    const res = await fetch(`/api/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editValues),
    })
    if (res.ok) {
      await loadAll()
      setEditingId(null)
      setSuccessMsg('Changes saved.')
      setTimeout(() => setSuccessMsg(null), 3000)
    } else {
      const data = await res.json()
      setError(data.error ?? 'Failed to save')
    }
    setSaving(false)
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail, name: inviteName, role: inviteRole }),
    })
    if (res.ok) {
      setShowInvite(false)
      setInviteEmail('')
      setInviteName('')
      await loadAll()
      setSuccessMsg('Invite sent! They will receive a magic link to set their password.')
      setTimeout(() => setSuccessMsg(null), 5000)
    } else {
      const data = await res.json()
      setError(data.error ?? 'Failed to invite')
    }
    setSaving(false)
  }

  const needsSetup = users.filter(u =>
    (u.role === 'sdr' || u.role === 'closer') &&
    (u.monthly_demo_target === null || u.monthly_revenue_target === null)
  )

  // Payout totals
  const perfValues = Object.values(perf)
  const totalBaseSalary = perfValues.reduce((s, p) => s + p.base_salary, 0)
  const totalIncentive = perfValues.reduce((s, p) => s + p.est_incentive, 0)
  const totalPayout = totalBaseSalary + totalIncentive

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-[#1A56DB] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="flex-1 flex flex-col">
      <TopBar title="Team Management" subtitle="Manage roles, targets & compensation" />

      <div className="flex-1 p-6 space-y-5 overflow-y-auto">

        {/* Alert: members needing target setup */}
        {needsSetup.length > 0 && (
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                {needsSetup.length} member{needsSetup.length > 1 ? 's' : ''} need targets assigned
              </p>
              <p className="text-xs text-amber-600 mt-0.5">
                {needsSetup.map(u => u.name).join(', ')} — click the edit icon to set their demo and revenue targets.
              </p>
            </div>
          </div>
        )}

        {/* Payout summary banner */}
        {perfValues.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total Base Salary', value: formatCurrency(totalBaseSalary), color: '#1A56DB' },
              { label: 'Est. Incentives This Month', value: formatCurrency(totalIncentive), color: '#7C3AED' },
              { label: 'Est. Total Payout', value: formatCurrency(totalPayout), color: '#059669' },
            ].map(item => (
              <div key={item.label} className="bg-white rounded-xl border border-[#E2E8F0] px-5 py-4 shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8]">{item.label}</p>
                <p className="text-xl font-bold mt-1" style={{ color: item.color }}>{item.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <p className="text-sm text-[#64748B]">{users.filter(u => u.is_active).length} active members</p>
            <span className="text-xs text-[#94A3B8]">· Incentive: SDR ₹500/demo · Closer 7% of revenue · multiplied by achievement tier</span>
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
          <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600 flex items-center justify-between">
            {error}
            <button onClick={() => setError(null)}><X className="w-3.5 h-3.5" /></button>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-green-50 border border-green-100 rounded-lg text-sm text-green-700">
            {successMsg}
          </div>
        )}

        {/* Invite form */}
        {showInvite && (
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-[#0F172A] mb-1">Invite New Member</h3>
            <p className="text-xs text-[#64748B] mb-4">They will receive a magic link to set their password. You can set their targets after they join.</p>
            <form onSubmit={handleInvite} className="grid grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#64748B] mb-1">Full Name</label>
                <input value={inviteName} onChange={e => setInviteName(e.target.value)} required
                  className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20 focus:border-[#1A56DB]"
                  placeholder="Ravi Kumar" />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#64748B] mb-1">Email</label>
                <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} required
                  className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20 focus:border-[#1A56DB]"
                  placeholder="ravi@daanveda.com" />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#64748B] mb-1">Role</label>
                <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20">
                  <option value="sdr">SDR</option>
                  <option value="closer">Closer</option>
                  <option value="admin">Admin</option>
                  <option value="sales_ops">Sales Ops</option>
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
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-x-auto">
          <table className="w-full text-sm min-w-[1100px]">
            <thead>
              <tr className="bg-[#F1F5F9]">
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Member</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Role</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Demo Target</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Rev Target</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Base Salary</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Achievement</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Est. Incentive</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Total Payout</th>
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#64748B]">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {users.map(user => {
                const needsTarget = (user.role === 'sdr' || user.role === 'closer') &&
                  (user.monthly_demo_target === null || user.monthly_revenue_target === null)
                const p = perf[user.id]
                const isEditing = editingId === user.id

                return (
                  <tr key={user.id} className={`hover:bg-[#F8FAFC] transition-colors ${needsTarget ? 'bg-amber-50/40' : ''}`}>
                    {/* Member */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#1A56DB]/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-[#1A56DB] text-xs font-semibold">{user.name.charAt(0).toUpperCase()}</span>
                        </div>
                        <div>
                          {isEditing ? (
                            <input value={editValues.name ?? ''} onChange={e => setEditValues(v => ({ ...v, name: e.target.value }))}
                              className="px-2 py-1 text-sm border border-[#1A56DB] rounded focus:outline-none w-36" />
                          ) : (
                            <p className="font-medium text-[#0F172A]">{user.name}</p>
                          )}
                          <p className="text-xs text-[#94A3B8]">{user.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="px-5 py-3.5">
                      {isEditing ? (
                        <select value={editValues.role ?? user.role} onChange={e => setEditValues(v => ({ ...v, role: e.target.value }))}
                          className="px-2 py-1 text-sm border border-[#1A56DB] rounded focus:outline-none">
                          <option value="sdr">SDR</option>
                          <option value="closer">Closer</option>
                          <option value="admin">Admin</option>
                          <option value="sales_ops">Sales Ops</option>
                        </select>
                      ) : (
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGES[user.role] ?? 'bg-slate-100 text-slate-600'}`}>
                          {user.role.toUpperCase()}
                        </span>
                      )}
                    </td>

                    {/* Demo Target */}
                    <td className="px-5 py-3.5">
                      {isEditing ? (
                        <input type="number" min="0" value={editValues.monthly_demo_target ?? 0}
                          onChange={e => setEditValues(v => ({ ...v, monthly_demo_target: Number(e.target.value) }))}
                          className="px-2 py-1 text-sm border border-[#1A56DB] rounded focus:outline-none w-20" />
                      ) : user.monthly_demo_target !== null ? (
                        <span className="text-[#0F172A]">{user.monthly_demo_target} demos</span>
                      ) : (
                        <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> Not set
                        </span>
                      )}
                    </td>

                    {/* Revenue Target */}
                    <td className="px-5 py-3.5">
                      {isEditing ? (
                        <input type="number" min="0" value={editValues.monthly_revenue_target ?? 0}
                          onChange={e => setEditValues(v => ({ ...v, monthly_revenue_target: Number(e.target.value) }))}
                          className="px-2 py-1 text-sm border border-[#1A56DB] rounded focus:outline-none w-28" />
                      ) : user.monthly_revenue_target !== null ? (
                        <span className="text-[#0F172A]">{formatCurrency(user.monthly_revenue_target)}</span>
                      ) : (
                        <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> Not set
                        </span>
                      )}
                    </td>

                    {/* Base Salary */}
                    <td className="px-5 py-3.5">
                      {isEditing ? (
                        <input type="number" min="0" value={editValues.monthly_base_salary ?? 0}
                          onChange={e => setEditValues(v => ({ ...v, monthly_base_salary: Number(e.target.value) }))}
                          className="px-2 py-1 text-sm border border-[#1A56DB] rounded focus:outline-none w-28"
                          placeholder="₹ per month" />
                      ) : user.monthly_base_salary ? (
                        <span className="text-[#0F172A] font-medium">{formatCurrency(user.monthly_base_salary)}</span>
                      ) : (
                        <span className="text-xs text-[#94A3B8]">—</span>
                      )}
                    </td>

                    {/* Achievement */}
                    <td className="px-5 py-3.5">
                      {p ? (
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                            <div className="h-full rounded-full"
                              style={{
                                width: `${Math.min(p.achievement_pct, 100)}%`,
                                backgroundColor: p.achievement_pct < 70 ? '#EF4444' : p.achievement_pct < 100 ? '#F59E0B' : '#059669',
                              }} />
                          </div>
                          <span className={`text-xs font-semibold ${p.achievement_pct < 70 ? 'text-red-500' : p.achievement_pct < 100 ? 'text-amber-500' : 'text-green-600'}`}>
                            {p.achievement_pct}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-[#94A3B8]">—</span>
                      )}
                    </td>

                    {/* Est. Incentive */}
                    <td className="px-5 py-3.5">
                      {p ? (
                        <div>
                          <span className="font-medium text-[#7C3AED]">{formatCurrency(p.est_incentive)}</span>
                          {p.multiplier > 0 && (
                            <span className="ml-1 text-[10px] text-[#94A3B8]">{p.multiplier}×</span>
                          )}
                          {p.multiplier === 0 && (
                            <span className="ml-1 text-[10px] text-red-400">locked</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-[#94A3B8]">—</span>
                      )}
                    </td>

                    {/* Total Payout */}
                    <td className="px-5 py-3.5">
                      {p && (p.base_salary > 0 || p.est_incentive > 0) ? (
                        <span className="font-semibold text-[#059669]">{formatCurrency(p.total_payout)}</span>
                      ) : (
                        <span className="text-xs text-[#94A3B8]">—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3.5">
                      {isEditing ? (
                        <select value={String(editValues.is_active)} onChange={e => setEditValues(v => ({ ...v, is_active: e.target.value === 'true' }))}
                          className="px-2 py-1 text-sm border border-[#1A56DB] rounded focus:outline-none">
                          <option value="true">Active</option>
                          <option value="false">Inactive</option>
                        </select>
                      ) : (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${user.is_active ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-500'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${user.is_active ? 'bg-green-500' : 'bg-slate-400'}`} />
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      )}
                    </td>

                    {/* Edit */}
                    <td className="px-5 py-3.5">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => saveEdit(user.id)} disabled={saving}
                            className="p-1.5 bg-[#059669] text-white rounded hover:bg-[#047857] disabled:opacity-60 transition-colors" title="Save">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setEditingId(null)}
                            className="p-1.5 bg-slate-100 text-[#64748B] rounded hover:bg-slate-200 transition-colors" title="Cancel">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => startEdit(user)}
                          className={`p-1.5 rounded transition-colors ${needsTarget ? 'text-amber-500 hover:text-amber-700 hover:bg-amber-100' : 'text-[#64748B] hover:text-[#1A56DB] hover:bg-[#F8FAFC]'}`}
                          title="Edit member">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {users.length === 0 && (
            <div className="text-center py-12 text-[#64748B] text-sm">
              No team members yet. Invite your first SDR or Closer above.
            </div>
          )}
        </div>

        {/* Incentive formula note */}
        <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg">
          <TrendingUp className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
          <p className="text-xs text-blue-700">
            <span className="font-semibold">Incentive formula:</span> SDR = ₹500 × demos booked × tier multiplier · Closer = 7% of revenue closed × tier multiplier ·
            Tier multipliers: &lt;70% = 0× · 70–99% = 1× · 100–119% = 1.25× · 120%+ = 1.5×
          </p>
        </div>

      </div>
    </div>
  )
}
