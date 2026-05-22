'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    const supabase = createClient()

    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    // Route to the user's workspace
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('auth_id', user.id)
        .single()

      const roleMap: Record<string, string> = {
        admin: '/admin',
        sdr: '/sdr',
        closer: '/closer',
        sales_ops: '/admin',
      }

      const p = profile as { role: string } | null
      router.push(p?.role ? (roleMap[p.role] ?? '/sdr') : '/sdr')
      router.refresh()
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] p-8">
      <h2 className="text-xl font-semibold text-[#0F172A] mb-1">Set your password</h2>
      <p className="text-sm text-[#64748B] mb-6">
        Choose a secure password to access your DaanVeda CRM account.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-[#64748B] uppercase tracking-wide mb-1.5">
            New password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-3 py-2.5 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A]
                       placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20
                       focus:border-[#1A56DB] transition-colors"
            placeholder="Min. 8 characters"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-[#64748B] uppercase tracking-wide mb-1.5">
            Confirm password
          </label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            className="w-full px-3 py-2.5 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A]
                       placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20
                       focus:border-[#1A56DB] transition-colors"
            placeholder="••••••••"
          />
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-100">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 px-4 bg-[#1A56DB] hover:bg-[#1A4FBF] disabled:opacity-60
                     text-white font-medium text-sm rounded-lg transition-colors"
        >
          {loading ? 'Setting password...' : 'Set password and continue'}
        </button>
      </form>

      <p className="mt-6 text-xs text-center text-[#94A3B8]">
        DaanVeda CRM · Internal tool · v1.0
      </p>
    </div>
  )
}
