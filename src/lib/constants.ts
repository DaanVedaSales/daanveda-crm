import type { LeadStatus, InterestSignal, ActivityType, DealStage, DemoStatus } from '@/types/database'

// ─── Lead Status Config ──────────────────────────────────────────────────────

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'New',
  assigned: 'Assigned',
  contacted: 'Contacted',
  call_again: 'Call Again',
  hot: 'Hot',
  demo_booked: 'Demo Booked',
  not_interested: 'Not Interested',
  not_reachable: 'Not Reachable',
  recycled: 'Recycled',
  demo_done: 'Demo Done',
  proposal_sent: 'Proposal Sent',
  follow_up: 'Follow Up',
  negotiation: 'Negotiation',
  won: 'Won',
  lost: 'Lost',
  ghosted: 'Ghosted',
  converted: 'Converted',
  no_show: 'No Show',
}

export const LEAD_STATUS_COLORS: Record<LeadStatus, string> = {
  new: 'bg-slate-100 text-slate-600',
  assigned: 'bg-blue-50 text-blue-600',
  contacted: 'bg-indigo-50 text-indigo-600',
  call_again: 'bg-amber-50 text-amber-600',
  hot: 'bg-red-50 text-red-600',
  demo_booked: 'bg-green-50 text-green-600',
  not_interested: 'bg-slate-100 text-slate-500',
  not_reachable: 'bg-slate-100 text-slate-500',
  recycled: 'bg-purple-50 text-purple-600',
  demo_done: 'bg-teal-50 text-teal-600',
  proposal_sent: 'bg-cyan-50 text-cyan-600',
  follow_up: 'bg-amber-50 text-amber-600',
  negotiation: 'bg-orange-50 text-orange-600',
  won: 'bg-green-50 text-green-700',
  lost: 'bg-red-50 text-red-500',
  ghosted: 'bg-slate-100 text-slate-500',
  converted: 'bg-green-100 text-green-800',
  no_show: 'bg-red-100 text-red-700',
}

// ─── Interest Signal Config ──────────────────────────────────────────────────

export const INTEREST_SIGNAL_LABELS: Record<InterestSignal, string> = {
  hot: '🔥 Hot',
  warm: '✨ Warm',
  cold: '❄️ Cold',
  dead: '💀 Dead',
}

export const INTEREST_SIGNAL_COLORS: Record<InterestSignal, string> = {
  hot: 'bg-red-500 text-white',
  warm: 'bg-amber-400 text-white',
  cold: 'bg-blue-400 text-white',
  dead: 'bg-slate-400 text-white',
}

// ─── Deal Stage Config ───────────────────────────────────────────────────────

export const DEAL_STAGE_LABELS: Record<DealStage, string> = {
  demo_scheduled: 'Demo Scheduled',
  demo_done: 'Demo Done',
  unqualified: 'Unqualified',
  proposal_sent: 'Proposal Sent',
  follow_up: 'Follow Up',
  negotiation: 'Negotiation',
  converting_later: 'Converting Later',
  won: 'Won',
  lost: 'Lost',
  ghosted: 'Ghosted',
  invoice_sent: 'Invoice Sent',
  converted: 'Converted',
}

export const DEAL_STAGE_COLORS: Record<DealStage, string> = {
  demo_scheduled: '#7C3AED',
  demo_done: '#1A56DB',
  unqualified: '#D97706',
  proposal_sent: '#0891B2',
  follow_up: '#F59E0B',
  negotiation: '#EA580C',
  converting_later: '#0D9488',
  won: '#059669',
  lost: '#EF4444',
  ghosted: '#94A3B8',
  invoice_sent: '#0891B2',
  converted: '#047857',
}

// Kanban columns — proposal_sent is now a button action, not a column
export const KANBAN_STAGES: DealStage[] = [
  'demo_scheduled', 'demo_done', 'follow_up', 'negotiation', 'converting_later', 'won', 'lost', 'ghosted', 'unqualified'
]

// ─── Activity Channels ───────────────────────────────────────────────────────

export const ACTIVITY_CHANNELS = [
  { value: 'Cold Call', label: '📞 Cold Call' },
  { value: 'Cold Email', label: '📧 Cold Email' },
  { value: 'LinkedIn', label: '💼 LinkedIn' },
  { value: 'WhatsApp', label: '💬 WhatsApp' },
  { value: 'Referral', label: '🤝 Referral' },
]

export const ACTIVITY_OUTCOMES = [
  { value: 'Demo Booked', label: '✅ Demo Booked' },
  { value: 'Not Interested', label: '❌ Not Interested' },
  { value: 'Call Again', label: '🔄 Call Again' },
  { value: 'Not Reachable', label: '📵 Not Reachable' },
  { value: 'Other', label: '📝 Other' },
]

// ─── Commission Structure (reference) ────────────────────────────────────────
// NOTE: the live payout math is computed inline in the SDR/Closer dashboards and
// /api/team/performance. These constants mirror that structure for reference and
// must be kept in sync with it.

// SDR — flat per WON deal (no achievement multiplier):
//   deal_value < ₹1L → ₹200/deal · deal_value ≥ ₹1L → ₹500/deal
export const SDR_COMMISSION = {
  threshold: 100000,
  belowThreshold: 200,
  atOrAboveThreshold: 500,
}

// Closer — plan tier (by deal_value) selects which rate column applies:
export const COMMISSION_PLAN_TIERS = [
  { label: '< ₹60K', min: 0, max: 60000, tier: 'base' },
  { label: '₹60K–₹1.2L', min: 60000, max: 120000, tier: 'mid' },
  { label: '₹1.2L+', min: 120000, max: Infinity, tier: 'custom' },
]

// Closer — rate = f(plan tier, achievement %); < 70% pays nothing.
export const COMMISSION_TIER_RATES: Record<'base' | 'mid' | 'custom', { minPct: number; maxPct: number; rate: number }[]> = {
  base: [
    { minPct: 70, maxPct: 80, rate: 0.01 },
    { minPct: 80, maxPct: 100, rate: 0.02 },
    { minPct: 100, maxPct: 120, rate: 0.04 },
    { minPct: 120, maxPct: Infinity, rate: 0.06 },
  ],
  mid: [
    { minPct: 70, maxPct: 80, rate: 0.02 },
    { minPct: 80, maxPct: 100, rate: 0.03 },
    { minPct: 100, maxPct: 120, rate: 0.06 },
    { minPct: 120, maxPct: Infinity, rate: 0.08 },
  ],
  custom: [
    { minPct: 70, maxPct: 80, rate: 0.04 },
    { minPct: 80, maxPct: 100, rate: 0.05 },
    { minPct: 100, maxPct: 120, rate: 0.08 },
    { minPct: 120, maxPct: Infinity, rate: 0.10 },
  ],
}

// Closer — 130%+ accelerator: +5% on revenue above 120% of target.
export const COMMISSION_ACCELERATOR = { minPct: 130, rate: 0.05, targetMultiple: 1.2 }

// ─── Navigation ──────────────────────────────────────────────────────────────

export const ADMIN_NAV = [
  { href: '/admin', label: 'Dashboard', icon: 'LayoutDashboard' },
  { href: '/admin/datasets', label: 'Datasets', icon: 'Database' },
  { href: '/admin/leads', label: 'Lead Pool', icon: 'Users' },
  { href: '/admin/team', label: 'Team', icon: 'UserCheck' },
]

export const SDR_NAV = [
  { href: '/sdr', label: 'Dashboard', icon: 'LayoutDashboard' },
  { href: '/sdr/leads', label: 'My Leads', icon: 'ClipboardList' },
  { href: '/sdr/followups', label: 'Follow-ups', icon: 'Clock' },
  { href: '/sdr/demos', label: 'My Demos', icon: 'CalendarCheck' },
]

export const CLOSER_NAV = [
  { href: '/closer', label: 'Dashboard', icon: 'LayoutDashboard' },
  { href: '/closer/pipeline', label: 'Pipeline', icon: 'Kanban' },
  { href: '/closer/today', label: 'Upcoming Demos', icon: 'Calendar' },
  { href: '/closer/past', label: 'Deal History', icon: 'History' },
]

// ─── SQL Score Rubric ────────────────────────────────────────────────────────

export const SQL_SCORE_RUBRIC = [
  { field: 'annual_revenue', label: 'Revenue ≥ ₹50L', points: 1, check: (v: number) => v >= 5000000 },
  { field: 'team_size', label: 'Team ≥ 10', points: 1, check: (v: number) => v >= 10 },
  { field: 'age_years', label: 'Age ≥ 3 years', points: 1, check: (v: number) => v >= 3 },
  { field: 'url', label: 'Website exists', points: 1, check: (v: string) => !!v },
  { field: 'linkedin_url', label: 'LinkedIn exists', points: 1, check: (v: string) => !!v },
  { field: 'thematic_areas', label: 'Thematic areas tagged', points: 1, check: (v: string[]) => v?.length > 0 },
  { field: 'location', label: 'Location known', points: 1, check: (v: string) => !!v },
  { field: 'kdm_email', label: 'KDM email available', points: 1, check: (v: string) => !!v },
]
