'use client'

import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DateTimePickerProps {
  value: string             // ISO datetime string or ''
  onChange: (value: string) => void
  minDate?: string          // ISO date string (YYYY-MM-DD)
  placeholder?: string
  className?: string
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseValue(val: string): { date: string; hour: number; minute: number; ampm: 'AM' | 'PM' } {
  if (!val) return { date: '', hour: 10, minute: 0, ampm: 'AM' }
  // val is ISO or datetime-local string
  const d = new Date(val)
  if (isNaN(d.getTime())) return { date: '', hour: 10, minute: 0, ampm: 'AM' }
  const h24 = d.getHours()
  const ampm = h24 >= 12 ? 'PM' : 'AM'
  const hour = h24 % 12 === 0 ? 12 : h24 % 12
  return {
    date: toLocalDateStr(d),
    hour,
    minute: d.getMinutes(),
    ampm,
  }
}

function buildISOString(date: string, hour: number, minute: number, ampm: 'AM' | 'PM'): string {
  if (!date) return ''
  const h24 = ampm === 'PM' ? (hour === 12 ? 12 : hour + 12) : (hour === 12 ? 0 : hour)
  const mm = String(minute).padStart(2, '0')
  const hh = String(h24).padStart(2, '0')
  // Construct as local datetime string — JS treats YYYY-MM-DDTHH:mm:ss as local time,
  // then .toISOString() converts to UTC so Postgres stores the correct moment.
  return new Date(`${date}T${hh}:${mm}:00`).toISOString()
}

export default function DateTimePicker({ value, onChange, minDate, placeholder = 'Select date & time', className }: DateTimePickerProps) {
  const parsed = parseValue(value)
  const [open,    setOpen]   = useState(false)
  const [date,    setDate]   = useState(parsed.date)
  const [hour,    setHour]   = useState(parsed.hour)
  const [minute,  setMinute] = useState(parsed.minute)
  const [ampm,    setAmpm]   = useState<'AM' | 'PM'>(parsed.ampm)

  // Calendar view state
  const today = new Date()
  const [viewYear,  setViewYear]  = useState(date ? parseInt(date.split('-')[0]) : today.getFullYear())
  const [viewMonth, setViewMonth] = useState(date ? parseInt(date.split('-')[1]) - 1 : today.getMonth())

  const ref = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)

  // Sync external value changes
  useEffect(() => {
    const p = parseValue(value)
    setDate(p.date)
    setHour(p.hour)
    setMinute(p.minute)
    setAmpm(p.ampm)
    if (p.date) {
      setViewYear(parseInt(p.date.split('-')[0]))
      setViewMonth(parseInt(p.date.split('-')[1]) - 1)
    }
  }, [value])

  // Close on outside click (trigger and the portaled popover are separate DOM subtrees)
  useEffect(() => {
    function handle(e: MouseEvent) {
      const t = e.target as Node
      if (ref.current?.contains(t)) return
      if (popoverRef.current?.contains(t)) return
      setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  // Position the portaled popover against the trigger; flip up / clamp to viewport,
  // and follow the trigger when an ancestor (modal/panel) scrolls.
  const reposition = useCallback(() => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const WIDTH = 320, GAP = 6
    const estHeight = popoverRef.current?.offsetHeight || 440
    let left = r.left
    if (left + WIDTH > window.innerWidth - 8) left = Math.max(8, window.innerWidth - WIDTH - 8)
    const spaceBelow = window.innerHeight - r.bottom
    const openUp = spaceBelow < estHeight + GAP && r.top > spaceBelow
    const top = openUp ? Math.max(8, r.top - GAP - estHeight) : r.bottom + GAP
    setCoords({ top, left })
  }, [])

  useLayoutEffect(() => {
    if (!open) { setCoords(null); return }
    reposition()
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
  }, [open, reposition])

  function emit(d: string, h: number, m: number, ap: 'AM' | 'PM') {
    const iso = buildISOString(d, h, m, ap)
    if (iso) onChange(iso)
  }

  function selectDate(d: string) {
    setDate(d)
    emit(d, hour, minute, ampm)
  }

  function setHourAndEmit(h: number) {
    setHour(h)
    emit(date, h, minute, ampm)
  }

  function setMinuteAndEmit(m: number) {
    setMinute(m)
    emit(date, hour, m, ampm)
  }

  function setAmpmAndEmit(ap: 'AM' | 'PM') {
    setAmpm(ap)
    emit(date, hour, minute, ap)
  }

  // Calendar grid
  const firstDay = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate()
  const cells: { day: number; month: 'prev' | 'cur' | 'next'; dateStr: string }[] = []

  for (let i = 0; i < firstDay; i++) {
    const d = prevMonthDays - firstDay + 1 + i
    const m = viewMonth === 0 ? 11 : viewMonth - 1
    const y = viewMonth === 0 ? viewYear - 1 : viewYear
    cells.push({ day: d, month: 'prev', dateStr: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, month: 'cur', dateStr: `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` })
  }
  const remaining = 42 - cells.length
  for (let i = 1; i <= remaining; i++) {
    const m = viewMonth === 11 ? 0 : viewMonth + 1
    const y = viewMonth === 11 ? viewYear + 1 : viewYear
    cells.push({ day: i, month: 'next', dateStr: `${y}-${String(m + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}` })
  }

  const todayStr = toLocalDateStr(today)

  // Display label
  let displayLabel = placeholder
  if (date && hour) {
    const d = new Date(`${date}T${String(ampm === 'PM' ? (hour === 12 ? 12 : hour + 12) : (hour === 12 ? 0 : hour)).toString().padStart(2, '0')}:${String(minute).padStart(2, '0')}`)
    if (!isNaN(d.getTime())) {
      displayLabel = d.toLocaleString('en-IN', {
        weekday: 'short', day: 'numeric', month: 'short',
        hour: '2-digit', minute: '2-digit', hour12: true,
      })
    }
  }

  const MINUTE_CHIPS = [0, 15, 30, 45]
  const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]

  return (
    <div ref={ref} className={cn('relative', className)}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 text-sm border rounded-lg transition-colors text-left',
          open
            ? 'border-[#1A56DB] ring-2 ring-[#1A56DB]/20'
            : 'border-[#E2E8F0] hover:border-[#CBD5E1]',
          date ? 'text-[#0F172A]' : 'text-[#94A3B8]'
        )}
      >
        <Clock className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
        <span className="flex-1 truncate">{displayLabel}</span>
      </button>

      {/* Popover — portaled to <body> so it escapes modal/panel overflow clipping */}
      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={popoverRef}
          className="fixed z-[100] bg-white rounded-2xl border border-[#E2E8F0] shadow-xl w-[320px]"
          style={{
            top: coords?.top ?? -9999,
            left: coords?.left ?? -9999,
            visibility: coords ? 'visible' : 'hidden',
            boxShadow: '0 8px 32px rgba(15,23,42,0.12)',
          }}
        >
          {/* ── Calendar ─────────────────────────────────── */}
          <div className="p-4 border-b border-[#F1F5F9]">
            {/* Month/Year nav */}
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={() => {
                  if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
                  else setViewMonth(m => m - 1)
                }}
                className="p-1 rounded-lg hover:bg-[#F1F5F9] text-[#64748B] transition-colors"
              >
                <ChevronLeft className="w-4 h-4" strokeWidth={2} />
              </button>
              <p className="text-[13px] font-semibold text-[#0F172A]">
                {MONTHS[viewMonth]} {viewYear}
              </p>
              <button
                type="button"
                onClick={() => {
                  if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
                  else setViewMonth(m => m + 1)
                }}
                className="p-1 rounded-lg hover:bg-[#F1F5F9] text-[#64748B] transition-colors"
              >
                <ChevronRight className="w-4 h-4" strokeWidth={2} />
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {DAYS.map(d => (
                <div key={d} className="text-center text-[10px] font-semibold text-[#94A3B8] py-1">{d}</div>
              ))}
            </div>

            {/* Date cells */}
            <div className="grid grid-cols-7 gap-y-0.5">
              {cells.map((cell, i) => {
                const isSelected = cell.dateStr === date
                const isToday    = cell.dateStr === todayStr
                const isPast     = minDate ? cell.dateStr < minDate : cell.dateStr < todayStr
                const isOtherMonth = cell.month !== 'cur'
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={isPast}
                    onClick={() => { selectDate(cell.dateStr) }}
                    className={cn(
                      'relative h-8 w-full flex items-center justify-center text-[12px] rounded-lg transition-colors',
                      isSelected && 'bg-[#1A56DB] text-white font-semibold',
                      !isSelected && isToday && 'text-[#1A56DB] font-bold',
                      !isSelected && !isOtherMonth && !isPast && 'text-[#0F172A] hover:bg-[#F1F5F9]',
                      isOtherMonth && 'text-[#CBD5E1]',
                      isPast && 'text-[#E2E8F0] cursor-not-allowed',
                    )}
                  >
                    {cell.day}
                    {isToday && !isSelected && (
                      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#1A56DB]" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Time Picker ───────────────────────────────── */}
          <div className="p-4 space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#94A3B8]">Time</p>

            {/* Hour row */}
            <div>
              <p className="text-[10px] text-[#94A3B8] mb-1.5">Hour</p>
              <div className="grid grid-cols-6 gap-1">
                {HOURS.map(h => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setHourAndEmit(h)}
                    className={cn(
                      'py-1.5 text-[11px] font-medium rounded-lg border transition-colors',
                      hour === h
                        ? 'bg-[#1A56DB] text-white border-[#1A56DB]'
                        : 'border-[#E2E8F0] text-[#374151] hover:border-[#CBD5E1]'
                    )}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>

            {/* Minute + AM/PM row */}
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <p className="text-[10px] text-[#94A3B8] mb-1.5">Minutes</p>
                <div className="grid grid-cols-4 gap-1">
                  {MINUTE_CHIPS.map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMinuteAndEmit(m)}
                      className={cn(
                        'py-1.5 text-[11px] font-medium rounded-lg border transition-colors',
                        minute === m
                          ? 'bg-[#1A56DB] text-white border-[#1A56DB]'
                          : 'border-[#E2E8F0] text-[#374151] hover:border-[#CBD5E1]'
                      )}
                    >
                      :{String(m).padStart(2, '0')}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] text-[#94A3B8] mb-1.5">AM/PM</p>
                <div className="flex border border-[#E2E8F0] rounded-lg overflow-hidden">
                  {(['AM', 'PM'] as const).map(ap => (
                    <button
                      key={ap}
                      type="button"
                      onClick={() => setAmpmAndEmit(ap)}
                      className={cn(
                        'px-3 py-1.5 text-[11px] font-semibold transition-colors',
                        ampm === ap
                          ? 'bg-[#1A56DB] text-white'
                          : 'text-[#64748B] hover:bg-[#F8FAFC]'
                      )}
                    >
                      {ap}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Done button */}
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={!date}
              className="w-full py-2 text-xs font-semibold bg-[#0F172A] text-white rounded-xl hover:bg-[#1E293B] disabled:opacity-40 disabled:cursor-not-allowed transition-colors mt-1"
            >
              {date ? `Confirm — ${displayLabel}` : 'Select a date first'}
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
