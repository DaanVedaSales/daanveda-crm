'use client'

import Link from 'next/link'

export default function SignupPage() {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] p-8 text-center">
      <div className="w-12 h-12 rounded-full bg-[#F1F5F9] flex items-center justify-center mx-auto mb-4">
        <svg className="w-6 h-6 text-[#64748B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
        </svg>
      </div>

      <h2 className="text-xl font-semibold text-[#0F172A] mb-2">Access by invitation only</h2>
      <p className="text-sm text-[#64748B] mb-6 leading-relaxed">
        DaanVeda CRM is an internal tool. Accounts are created by your admin.
        Check your email for an invite link, or contact your team lead.
      </p>

      <Link
        href="/login"
        className="inline-block w-full py-2.5 px-4 bg-[#1A56DB] hover:bg-[#1A4FBF]
                   text-white font-medium text-sm rounded-lg transition-colors text-center"
      >
        Back to sign in
      </Link>

      <p className="mt-6 text-xs text-center text-[#94A3B8]">
        DaanVeda CRM · Internal tool · v1.0
      </p>
    </div>
  )
}
