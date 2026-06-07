import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow, isToday, isTomorrow, isPast } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '—'
  if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(1)}L`
  }
  if (amount >= 1000) {
    return `₹${(amount / 1000).toFixed(0)}K`
  }
  return `₹${amount.toLocaleString('en-IN')}`
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return '—'
  return format(new Date(date), 'dd MMM yyyy')
}

export function formatDateTime(date: string | null | undefined): string {
  if (!date) return '—'
  return format(new Date(date), 'dd MMM yyyy, h:mm a')
}

export function formatRelativeDate(date: string | null | undefined): string {
  if (!date) return '—'
  const d = new Date(date)
  if (isToday(d)) return 'Today'
  if (isTomorrow(d)) return 'Tomorrow'
  if (isPast(d)) return `${formatDistanceToNow(d)} ago`
  return format(d, 'dd MMM')
}

export function getWorkingDaysInMonth(year: number, month: number): number {
  // Mon–Sat = 26 working days standard (DaanVeda business rule)
  return 26
}

export function getDailyPace(monthlyTarget: number): number {
  return monthlyTarget / 26
}

// Returns a Date object representing the current time in IST (UTC+5:30).
// Use this in all server-side date calculations to avoid UTC/IST timezone drift.
export function getNowIST(): Date {
  return new Date(new Date().getTime() + (5.5 * 60 * 60 * 1000))
}

// ── IST helpers (server-side) ────────────────────────────────────────────────
// The business runs in IST; Vercel servers run UTC. Use these so that "today",
// day/week/month boundaries, and date-typed fields are computed in IST.
// NOTE: absolute timestamps (created_at/updated_at/deleted_at) must stay
// `new Date().toISOString()` (UTC) — they record the correct instant and render
// as IST on the client. Only convert civil-date semantics with these helpers.
export const IST_TIMEZONE = 'Asia/Kolkata'

// 'YYYY-MM-DD' calendar date in IST for an instant (default: now).
// Robust regardless of the server's own timezone (uses Intl, not the runtime TZ).
export function toISTDateString(instant: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: IST_TIMEZONE }).format(instant)
}

// ── Phone search matching ────────────────────────────────────────────────────
// Stored phone numbers are inconsistently formatted (+91, spaces, no code, landlines).
// Normalize both sides to digits and substring-match so a query like "975" finds
// "+91 975…", "91975…", "975 12 345", etc. — and the national number matches a
// stored number that carries the 91 country code.
export function normalizePhone(s: string | null | undefined): string {
  return (s ?? '').replace(/\D/g, '')
}

export function phoneMatches(stored: string | null | undefined, query: string): boolean {
  const q = normalizePhone(query)
  if (!q) return false
  const s = normalizePhone(stored)
  if (!s) return false
  if (s.includes(q)) return true
  // Stored number carries a leading 91 country code → also match its national part.
  if (s.length > 10 && s.startsWith('91') && s.slice(2).includes(q)) return true
  return false
}

// ── IST display formatting (client-side) ─────────────────────────────────────
// Format any timestamp (ISO string or Date) for display in IST, regardless of
// the viewer's device timezone. Use for ALL user-facing date/time rendering so
// every screen agrees on the wall-clock — the business runs in IST, and devices
// set to other timezones would otherwise show shifted demo/follow-up times.
export function formatIST(value: string | Date | null | undefined, opts: Intl.DateTimeFormatOptions): string {
  if (!value) return ''
  const d = typeof value === 'string' ? new Date(value) : value
  if (isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-IN', { timeZone: IST_TIMEZONE, ...opts }).format(d)
}

// IST day boundaries as timestamptz literals — the +05:30 offset makes Postgres
// compare the correct absolute instant for an IST calendar day.
export function istDayStart(dateStr: string): string {
  return `${dateStr}T00:00:00.000+05:30`
}
export function istDayEnd(dateStr: string): string {
  return `${dateStr}T23:59:59.999+05:30`
}

// Monday (IST) of the week containing `instant`, as 'YYYY-MM-DD'.
export function istWeekStart(instant: Date = new Date()): string {
  const d = new Date(`${toISTDateString(instant)}T12:00:00Z`) // noon UTC of the IST date — avoids day-roll
  const offset = d.getUTCDay() === 0 ? 6 : d.getUTCDay() - 1   // days since Monday
  d.setUTCDate(d.getUTCDate() - offset)
  return toISTDateString(d)
}

export function getWorkingDaysElapsed(year: number, month: number, today?: Date): number {
  const todayDate = today ?? new Date()
  const start = new Date(year, month - 1, 1)
  let count = 0
  const d = new Date(start)
  while (d <= todayDate && d.getMonth() === month - 1) {
    const day = d.getDay()
    if (day !== 0) count++ // exclude Sundays; Mon–Sat count
    d.setDate(d.getDate() + 1)
  }
  return count
}

export function calculatePaceRequired(
  target: number,
  achieved: number,
  daysElapsed: number,
  totalDays = 26
): number {
  const daysLeft = totalDays - daysElapsed
  if (daysLeft <= 0) return 0
  const remaining = target - achieved
  return remaining / daysLeft
}

export function getPaceStatus(
  target: number,
  achieved: number,
  daysElapsed: number
): 'on_track' | 'behind' | 'ahead' | 'critical' {
  if (target === 0) return 'on_track'
  const expectedByNow = (target / 26) * daysElapsed
  const ratio = achieved / expectedByNow
  if (ratio >= 1.1) return 'ahead'
  if (ratio >= 0.85) return 'on_track'
  if (ratio >= 0.6) return 'behind'
  return 'critical'
}
