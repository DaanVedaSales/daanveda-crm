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
  won: '#059669',
  lost: '#EF4444',
  ghosted: '#94A3B8',
  invoice_sent: '#0891B2',
  converted: '#047857',
}

// Kanban columns — proposal_sent is now a button action, not a column
export const KANBAN_STAGES: DealStage[] = [
  'demo_scheduled', 'demo_done', 'follow_up', 'negotiation', 'won', 'lost', 'ghosted', 'unqualified'
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

// ─── Commission Tiers ────────────────────────────────────────────────────────
// Two-dimensional: plan tier × achievement %

export const COMMISSION_PLAN_TIERS = [
  { label: '₹30K–₹60K', min: 30000, max: 60000, tier: 'base' },
  { label: '₹60K–₹1.2L', min: 60000, max: 120000, tier: 'mid' },
  { label: '₹1.2L+', min: 120000, max: Infinity, tier: 'premium' },
]

export const COMMISSION_ACHIEVEMENT_RATES = [
  { label: '<70%', minPct: 0, maxPct: 70, multiplier: 0 },
  { label: '70–99%', minPct: 70, maxPct: 100, multiplier: 1 },
  { label: '100–119%', minPct: 100, maxPct: 120, multiplier: 1.25 },
  { label: '120%+', minPct: 120, maxPct: Infinity, multiplier: 1.5 },
]

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
