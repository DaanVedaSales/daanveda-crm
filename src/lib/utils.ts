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

export function getWorkingDaysElapsed(year: number, month: number): number {
  const today = new Date()
  const start = new Date(year, month - 1, 1)
  let count = 0
  const d = new Date(start)
  while (d <= today && d.getMonth() === month - 1) {
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
