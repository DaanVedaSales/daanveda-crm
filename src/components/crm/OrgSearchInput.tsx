'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { OrgSearchResult } from '@/app/api/organizations/search/route'

// Status badge config — shared with OrgSearchModal
export const ORG_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  active_client: { label: 'Active Client',  className: 'bg-[#D1FAE5] text-[#065F46]' },
  lost:          { label: 'Previously Lost', className: 'bg-[#FEE2E2] text-[#991B1B]' },
  ghosted:       { label: 'Ghosted',         className: 'bg-[#F1F5F9] text-[#475569]' },
  in_pipeline:   { label: 'In Pipeline',     className: 'bg-[#EFF6FF] text-[#1D4ED8]' },
  demo_booked:   { label: 'Demo Booked',     className: 'bg-[#F3E8FF] text-[#6B21A8]' },
  with_sdr:      { label: 'With SDR',        className: 'bg-[#FEF3C7] text-[#92400E]' },
  in_lead_pool:  { label: 'Lead Pool',       className: 'bg-[#ECFDF5] text-[#065F46]' },
  in_database:   { label: 'In Database',     className: 'bg-[#F8FAFC] text-[#475569] border border-[#E2E8F0]' },
}

interface OrgSearchInputProps {
  value: string
  onChange: (value: string) => void
  onOrgSelected: (org: OrgSearchResult | null) => void
  placeholder?: string
  inputClassName?: string
  required?: boolean
}

// Inline search-as-you-type input for org name fields.
// Shows a dropdown of matching orgs with status badges.
// Selecting an org fills the name and calls onOrgSelected — the parent
// decides how to show warnings or pre-fill other fields.
export default function OrgSearchInput({
  value,
  onChange,
  onOrgSelected,
  placeholder = 'Organisation name',
  inputClassName,
  required,
}: OrgSearchInputProps) {
  const [results,   setResults]   = useState<OrgSearchResult[]>([])
  const [loading,   setLoading]   = useState(false)
  const [open,      setOpen]      = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!value || value.length < 2) {
      setResults([])
      setOpen(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/organizations/search?q=${encodeURIComponent(value)}&limit=8`)
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data) && data.length > 0) {
            setResults(data)
            setOpen(true)
            setActiveIdx(-1)
          } else {
            setResults([])
            setOpen(false)
          }
        }
      } catch { /* silent */ }
      setLoading(false)
    }, 280)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [value])

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  function selectOrg(org: OrgSearchResult) {
    onChange(org.name)
    onOrgSelected(org)
    setOpen(false)
    setResults([])
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault()
      selectOrg(results[activeIdx])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  function handleChange(v: string) {
    onChange(v)
    // Reset selected org if user edits the name after selecting
    onOrgSelected(null)
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          required={required}
          value={value}
          onChange={e => handleChange(e.target.value)}
          onFocus={() => { if (results.length > 0) setOpen(true) }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={inputClassName}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8] animate-spin pointer-events-none" />
        )}
        {!loading && value.length >= 2 && !open && (
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#CBD5E1] pointer-events-none" />
        )}
      </div>

      {open && results.length > 0 && (
        <div
          className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-[#E2E8F0] rounded-xl shadow-lg overflow-hidden"
          style={{ boxShadow: '0 4px 20px rgba(15,23,42,0.1)' }}
        >
          <div className="max-h-52 overflow-y-auto">
            {results.map((org, i) => {
              const cfg = ORG_STATUS_CONFIG[org.status] ?? ORG_STATUS_CONFIG.in_database
              return (
                <button
                  key={org.id}
                  type="button"
                  onMouseDown={e => { e.preventDefault(); selectOrg(org) }}
                  className={cn(
                    'w-full flex items-start gap-2.5 px-3 py-2.5 text-left transition-colors',
                    i === activeIdx ? 'bg-[#EFF6FF]' : 'hover:bg-[#F8FAFC]',
                    i > 0 && 'border-t border-[#F1F5F9]'
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-medium text-[#0F172A] truncate">{org.name}</span>
                      <span className={cn('shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full', cfg.className)}>
                        {cfg.label}
                      </span>
                    </div>
                    <div className="flex items-center flex-wrap gap-x-2 mt-0.5 text-[11px] text-[#94A3B8]">
                      {org.location && <span>{org.location}</span>}
                      {org.assignee_name && (
                        <span>· {org.assignee_role === 'sdr' ? 'SDR' : 'Closer'}: {org.assignee_name}</span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
          <div className="px-3 py-1.5 bg-[#F8FAFC] border-t border-[#F1F5F9]">
            <p className="text-[10px] text-[#94A3B8]">↑↓ navigate · Enter to select · Esc to close</p>
          </div>
        </div>
      )}
    </div>
  )
}
