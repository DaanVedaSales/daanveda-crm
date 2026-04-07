// ─── Enum Types ──────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'sdr' | 'closer' | 'sales_ops'

export type LeadStatus =
  | 'new' | 'assigned' | 'contacted' | 'call_again' | 'hot' | 'demo_booked'
  | 'not_interested' | 'not_reachable' | 'recycled'
  | 'demo_done' | 'proposal_sent' | 'follow_up' | 'negotiation'
  | 'won' | 'lost' | 'ghosted' | 'converted'

export type LeadPhase = 'sdr' | 'closer' | 'recycled' | 'converted' | 'dead'

export type InterestSignal = 'hot' | 'warm' | 'cold' | 'dead'

export type DemoStatus = 'scheduled' | 'attended' | 'no_show' | 'rescheduled' | 'cancelled'

export type DealStage =
  | 'demo_done' | 'proposal_sent' | 'follow_up' | 'negotiation'
  | 'won' | 'lost' | 'ghosted' | 'invoice_sent' | 'converted'

export type InvoiceStatus = 'not_generated' | 'sent' | 'paid' | 'overdue'

export type ActivityType =
  | 'call' | 'email' | 'linkedin' | 'whatsapp' | 'note' | 'status_change'
  | 'assignment' | 'demo_booked' | 'follow_up' | 'dataset_rating'

export type DatasetSource = 'NGOverse' | 'LinkedIn' | 'Manual' | 'Referral' | 'Other'

export type LeadType = 'Inbound' | 'Outbound' | 'Referral'

// ─── Table Row Types ──────────────────────────────────────────────────────────

export interface User {
  id: string
  auth_id: string | null
  email: string
  name: string
  role: UserRole
  phone: string | null
  calendar_link: string | null
  monthly_demo_target: number
  monthly_revenue_target: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Dataset {
  id: string
  name: string
  source: DatasetSource
  uploaded_by: string | null
  total_records: number
  notes: string | null
  created_at: string
}

export interface Organization {
  id: string
  dataset_id: string | null
  name: string
  url: string | null
  linkedin_url: string | null
  location: string | null
  thematic_areas: string[] | null
  annual_revenue: number | null
  team_size: number | null
  age_years: number | null
  sql_score: number
  icp_verified: boolean
  created_at: string
  updated_at: string
}

export interface Contact {
  id: string
  org_id: string
  name: string
  designation: string | null
  phone: string | null
  email: string | null
  linkedin_url: string | null
  is_primary: boolean
  is_verified: boolean
  created_at: string
  updated_at: string
}

export interface Lead {
  id: string
  org_id: string
  dataset_id: string | null
  lead_type: LeadType
  assigned_to: string | null
  assigned_by: string | null
  status: LeadStatus
  phase: LeadPhase
  interest_signal: InterestSignal | null
  callback_date: string | null
  follow_up_date: string | null
  recycle_date: string | null
  recycle_reason: string | null
  created_at: string
  updated_at: string
}

export interface Activity {
  id: string
  lead_id: string
  org_id: string
  user_id: string
  activity_type: ActivityType
  channel: string | null
  outcome: string | null
  notes: string | null
  old_value: string | null
  new_value: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface Demo {
  id: string
  lead_id: string
  org_id: string
  sdr_id: string  // IMMUTABLE — attribution for SDR bonus
  closer_id: string | null
  demo_date: string
  sdr_summary: string  // MANDATORY ≥50 chars
  sdr_interest_signal: InterestSignal | null
  status: DemoStatus
  post_demo_notes: string | null
  handoff_at: string
  calendar_invite_sent: boolean
  reminder_sent: boolean
  created_at: string
  updated_at: string
}

export interface Deal {
  id: string
  demo_id: string | null
  lead_id: string
  org_id: string
  closer_id: string
  stage: DealStage
  deal_value: number | null  // must be ≥ 30000
  plan_type: 'annual' | 'monthly' | null
  next_follow_up: string | null
  follow_up_count: number
  first_demo_date: string | null
  date_won_lost: string | null
  sales_cycle_days: number | null  // generated column
  loss_reason: string | null       // MANDATORY when stage = lost
  billing_name: string | null      // MANDATORY when stage = won
  billing_address: string | null
  gst_number: string | null
  invoice_status: InvoiceStatus
  payment_confirmed: boolean
  onboarding_issued: boolean
  created_at: string
  updated_at: string
}

export interface DatasetRating {
  id: string
  dataset_id: string
  user_id: string
  quality_score: number | null   // 1–5
  accuracy_score: number | null  // 1–5
  notes: string | null
  created_at: string
}

export interface LeadAssignment {
  id: string
  lead_id: string
  from_user_id: string | null
  to_user_id: string
  assigned_by: string
  reason: string | null
  created_at: string
}

export interface SalaryTarget {
  id: string
  user_id: string
  month: number    // 1–12
  year: number
  salary: number
  demo_target: number
  revenue_target: number
  locked_at: string
  locked_by: string | null
}

export interface Commission {
  id: string
  user_id: string
  deal_id: string | null
  month: number
  year: number
  deal_value: number | null
  plan_tier: string | null
  achievement_pct: number | null
  commission_rate: number | null
  commission_amt: number | null
  bonus_type: string | null
  created_at: string
}

// ─── Joined/Extended Types ────────────────────────────────────────────────────

export interface LeadWithOrg extends Lead {
  organization: Organization
  contacts?: Contact[]
}

export interface DemoWithDetails extends Demo {
  lead: Lead
  organization: Organization
  sdr: User
  closer?: User
}

export interface DealWithDetails extends Deal {
  lead: Lead
  organization: Organization
  demo?: Demo
}

export interface ActivityWithUser extends Activity {
  user: Pick<User, 'id' | 'name' | 'role'>
}

// ─── Supabase Database Type ───────────────────────────────────────────────────

export type Database = {
  public: {
    Tables: {
      users: { Row: User; Insert: Partial<User>; Update: Partial<User> }
      datasets: { Row: Dataset; Insert: Partial<Dataset>; Update: Partial<Dataset> }
      organizations: { Row: Organization; Insert: Partial<Organization>; Update: Partial<Organization> }
      contacts: { Row: Contact; Insert: Partial<Contact>; Update: Partial<Contact> }
      leads: { Row: Lead; Insert: Partial<Lead>; Update: Partial<Lead> }
      activities: { Row: Activity; Insert: Partial<Activity>; Update: Partial<Activity> }
      demos: { Row: Demo; Insert: Partial<Demo>; Update: Partial<Demo> }
      deals: { Row: Deal; Insert: Partial<Deal>; Update: Partial<Deal> }
      dataset_ratings: { Row: DatasetRating; Insert: Partial<DatasetRating>; Update: Partial<DatasetRating> }
      lead_assignments: { Row: LeadAssignment; Insert: Partial<LeadAssignment>; Update: Partial<LeadAssignment> }
      salary_targets: { Row: SalaryTarget; Insert: Partial<SalaryTarget>; Update: Partial<SalaryTarget> }
      commissions: { Row: Commission; Insert: Partial<Commission>; Update: Partial<Commission> }
    }
    Enums: {
      user_role: UserRole
      lead_status: LeadStatus
      lead_phase: LeadPhase
      interest_signal: InterestSignal
      demo_status: DemoStatus
      deal_stage: DealStage
      invoice_status: InvoiceStatus
      activity_type: ActivityType
      dataset_source: DatasetSource
      lead_type: LeadType
    }
  }
}
