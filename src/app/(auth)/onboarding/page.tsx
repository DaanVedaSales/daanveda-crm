'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const ROLES = [
  {
    id: 'sdr',
    title: 'SDR',
    subtitle: 'Sales Development Representative',
    description: 'Prospect leads, make calls, book demos, and hand off to Closers.',
    icon: '📞',
  },
  {
    id: 'closer',
    title: 'Closer',
    subtitle: 'Account Executive',
    description: 'Receive demos from SDRs, run pitches, manage pipeline, and close deals.',
    icon: '🤝',
  },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = async () => {
    if (!selectedRole) return
    setLoading(true)
    setError(null)

    const res = await fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: selectedRole }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Something went wrong. Please try again.')
      setLoading(false)
      return
    }

    // Redirect to role workspace
    const workspaceMap: Record<string, string> = {
      sdr: '/sdr',
      closer: '/closer',
    }
    router.push(workspaceMap[selectedRole] ?? '/sdr')
    router.refresh()
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] p-8">
      <div className="text-center mb-8">
        <div className="w-12 h-12 bg-[#1A56DB]/10 rounded-full flex items-center justify-center mx-auto mb-3">
          <span className="text-2xl">👋</span>
        </div>
        <h2 className="text-xl font-semibold text-[#0F172A] mb-1">Welcome to DaanVeda CRM</h2>
        <p className="text-sm text-[#64748B]">Select your role to set up your workspace</p>
      </div>

      <div className="space-y-3 mb-6">
        {ROLES.map((role) => (
          <button
            key={role.id}
            onClick={() => setSelectedRole(role.id)}
            className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
              selectedRole === role.id
                ? 'border-[#1A56DB] bg-[#1A56DB]/5'
                : 'border-[#E2E8F0] hover:border-[#1A56DB]/40 hover:bg-[#F8FAFC]'
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl mt-0.5">{role.icon}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[#0F172A] text-sm">{role.title}</span>
                  <span className="text-xs text-[#64748B]">— {role.subtitle}</span>
                </div>
                <p className="text-xs text-[#64748B] mt-1 leading-relaxed">{role.description}</p>
              </div>
              <div className={`w-4 h-4 rounded-full border-2 mt-1 flex-shrink-0 transition-colors ${
                selectedRole === role.id
                  ? 'border-[#1A56DB] bg-[#1A56DB]'
                  : 'border-[#CBD5E1]'
              }`}>
                {selectedRole === role.id && (
                  <div className="w-full h-full rounded-full flex items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-white rounded-full" />
                  </div>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="p-3 rounded-lg bg-amber-50 border border-amber-100 mb-6">
        <p className="text-xs text-amber-700">
          <strong>Note:</strong> Admin and Sales Ops accounts are set up by your manager.
          If you need a different role, contact your administrator.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-100 mb-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <button
        onClick={handleConfirm}
        disabled={!selectedRole || loading}
        className="w-full py-2.5 px-4 bg-[#1A56DB] hover:bg-[#1A4FBF] disabled:opacity-50
                   disabled:cursor-not-allowed text-white font-medium text-sm rounded-lg transition-colors"
      >
        {loading ? 'Setting up workspace...' : selectedRole ? `Continue as ${selectedRole.toUpperCase()} →` : 'Select a role to continue'}
      </button>

      <p className="mt-6 text-xs text-center text-[#94A3B8]">
        DaanVeda CRM · Internal tool · v1.0
      </p>
    </div>
  )
}
