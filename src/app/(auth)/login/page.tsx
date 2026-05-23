'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Mode = 'login' | 'forgot'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resetSent, setResetSent] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profileData } = await supabase
        .from('users')
        .select('role')
        .eq('auth_id', user.id)
        .single()

      const profile = profileData as { role: string } | null
      if (!profile) {
        router.push('/onboarding')
        return
      }

      const roleMap: Record<string, string> = {
        admin: '/admin',
        sdr: '/sdr',
        closer: '/closer',
        sales_ops: '/admin',
      }
      router.push(roleMap[profile.role] ?? '/sdr')
      router.refresh()
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/auth/callback?next=/set-password`,
    })

    setLoading(false)
    if (resetError) {
      setError(resetError.message)
      return
    }
    setResetSent(true)
  }

  // ── Forgot password view ────────────────────────────────────────────────────
  if (mode === 'forgot') {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] p-8">
        <h2 className="text-xl font-semibold text-[#0F172A] mb-1">Reset your password</h2>
        <p className="text-sm text-[#64748B] mb-6">
          Enter your work email and we will send you a reset link.
        </p>

        {resetSent ? (
          <div className="p-4 rounded-lg bg-green-50 border border-green-100 text-center">
            <p className="text-sm text-green-700 font-medium">Reset link sent</p>
            <p className="text-xs text-green-600 mt-1">
              Check your email inbox and click the link to set a new password.
            </p>
          </div>
        ) : (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#64748B] uppercase tracking-wide mb-1.5">
                Work email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2.5 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A]
                           placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20
                           focus:border-[#1A56DB] transition-colors"
                placeholder="you@daanveda.com"
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
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
          </form>
        )}

        <p className="mt-4 text-sm text-center text-[#64748B]">
          <button
            onClick={() => { setMode('login'); setError(null); setResetSent(false) }}
            className="text-[#1A56DB] font-medium hover:underline"
          >
            Back to sign in
          </button>
        </p>

        <p className="mt-4 text-xs text-center text-[#94A3B8]">
          DaanVeda CRM · Internal tool · v1.0
        </p>
      </div>
    )
  }

  // ── Login view ──────────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] p-8">
      <h2 className="text-xl font-semibold text-[#0F172A] mb-1">Sign in</h2>
      <p className="text-sm text-[#64748B] mb-6">Enter your credentials to access your workspace</p>

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-[#64748B] uppercase tracking-wide mb-1.5">
            Email address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2.5 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A]
                       placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20
                       focus:border-[#1A56DB] transition-colors"
            placeholder="you@daanveda.com"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-medium text-[#64748B] uppercase tracking-wide">
              Password
            </label>
            <button
              type="button"
              onClick={() => { setMode('forgot'); setError(null) }}
              className="text-xs text-[#1A56DB] hover:underline"
            >
              Forgot password?
            </button>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <p className="mt-4 text-sm text-center text-[#64748B]">
        New to DaanVeda CRM?{' '}
        <Link href="/signup" className="text-[#1A56DB] font-medium hover:underline">
          Create account
        </Link>
      </p>

      <p className="mt-3 text-xs text-center text-[#94A3B8]">
        DaanVeda CRM · Internal tool · v1.0
      </p>
    </div>
  )
}
