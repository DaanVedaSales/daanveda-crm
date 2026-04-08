'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (!name.trim()) {
      setError('Please enter your full name.')
      return
    }

    setLoading(true)
    const supabase = createClient()

    const { error: signupError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name.trim() },
      },
    })

    if (signupError) {
      setError(signupError.message)
      setLoading(false)
      return
    }

    // Redirect to onboarding to select role
    router.push('/onboarding')
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] p-8">
      <h2 className="text-xl font-semibold text-[#0F172A] mb-1">Create your account</h2>
      <p className="text-sm text-[#64748B] mb-6">Join your DaanVeda sales team workspace</p>

      <form onSubmit={handleSignup} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-[#64748B] uppercase tracking-wide mb-1.5">
            Full name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-3 py-2.5 rounded-lg border border-[#E2E8F0] text-sm text-[#0F172A]
                       placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20
                       focus:border-[#1A56DB] transition-colors"
            placeholder="Rahul Sharma"
          />
        </div>

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
            placeholder="rahul@daanveda.com"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-[#64748B] uppercase tracking-wide mb-1.5">
            Password
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
          {loading ? 'Creating account...' : 'Create account'}
        </button>
      </form>

      <p className="mt-4 text-sm text-center text-[#64748B]">
        Already have an account?{' '}
        <Link href="/login" className="text-[#1A56DB] font-medium hover:underline">
          Sign in
        </Link>
      </p>

      <p className="mt-6 text-xs text-center text-[#94A3B8]">
        DaanVeda CRM · Internal tool · v1.0
      </p>
    </div>
  )
}
