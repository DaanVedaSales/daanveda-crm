'use client'

import { useEffect, useState } from 'react'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'

type UserPerf = {
  user_id: string
  role: string
  achievement_pct: number
  est_incentive: number
  base_salary: number
  total_payout: number
}

export default function PayoutSummary() {
  const [data, setData] = useState<UserPerf[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/team/performance')
      .then(r => r.json())
      .then(d => { setData(d ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading || data.length === 0) return null

  const totalBase = data.reduce((s, p) => s + p.base_salary, 0)
  const totalIncentive = data.reduce((s, p) => s + p.est_incentive, 0)
  const totalPayout = totalBase + totalIncentive

  // Top earners this month
  const topEarners = [...data].sort((a, b) => b.total_payout - a.total_payout).slice(0, 3)

  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-[#F1F5F9] flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[#0F172A]">Team Payout Estimate</h2>
          <p className="text-xs text-[#94A3B8] mt-0.5">Based on current month performance · SDR ₹200–₹500/won deal · Closer tier-based</p>
        </div>
        <Link href="/admin/team" className="text-xs text-[#1A56DB] hover:underline font-medium">
          Manage team →
        </Link>
      </div>

      <div className="p-5 grid grid-cols-3 gap-4 border-b border-[#F1F5F9]">
        {[
          { label: 'Total Base Salary', value: formatCurrency(totalBase), color: '#1A56DB' },
          { label: 'Est. Incentives', value: formatCurrency(totalIncentive), color: '#7C3AED' },
          { label: 'Est. Total Payout', value: formatCurrency(totalPayout), color: '#059669' },
        ].map(item => (
          <div key={item.label}>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8]">{item.label}</p>
            <p className="text-lg font-bold mt-0.5" style={{ color: item.color }}>{item.value}</p>
          </div>
        ))}
      </div>

      {topEarners.length > 0 && (
        <div className="px-5 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8] mb-2">Top Earners This Month</p>
          <div className="flex gap-6">
            {topEarners.map((p, i) => (
              <div key={p.user_id} className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-[#94A3B8]">#{i + 1}</span>
                <div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium mr-1 ${p.role === 'sdr' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-700'}`}>
                    {p.role.toUpperCase()}
                  </span>
                  <span className="text-xs font-semibold text-[#059669]">{formatCurrency(p.total_payout)}</span>
                  <span className="text-[10px] text-[#94A3B8] ml-1">· {p.achievement_pct}% achievement</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
