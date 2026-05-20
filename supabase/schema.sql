-- =============================================================================
-- DaanVeda CRM — Complete Database Schema
-- Run this in: Supabase → SQL Editor → New Query → Run
-- This creates the entire schema from scratch (no data).
-- =============================================================================

-- ── Extensions ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── Helper functions (used by RLS policies) ───────────────────────────────────
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT role FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION get_user_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$;

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE user_role     AS ENUM ('admin', 'sdr', 'closer', 'sales_ops');
CREATE TYPE lead_status   AS ENUM (
  'new', 'assigned', 'contacted', 'call_again', 'hot', 'demo_booked',
  'not_interested', 'not_reachable', 'recycled',
  'demo_done', 'proposal_sent', 'follow_up', 'negotiation',
  'won', 'lost', 'ghosted', 'converted'
);
CREATE TYPE lead_phase    AS ENUM ('sdr', 'closer', 'recycled', 'converted', 'dead');
CREATE TYPE lead_type     AS ENUM ('Inbound', 'Outbound', 'Referral');
CREATE TYPE interest_signal AS ENUM ('hot', 'warm', 'cold', 'dead');
CREATE TYPE activity_type AS ENUM (
  'call', 'email', 'linkedin', 'whatsapp', 'note',
  'status_change', 'assignment', 'demo_booked', 'follow_up', 'dataset_rating'
);
CREATE TYPE demo_status   AS ENUM ('scheduled', 'attended', 'no_show', 'rescheduled', 'cancelled');
CREATE TYPE deal_stage    AS ENUM (
  'demo_scheduled', 'demo_done', 'unqualified',
  'proposal_sent', 'follow_up', 'negotiation',
  'won', 'lost', 'ghosted', 'invoice_sent', 'converted'
);
CREATE TYPE invoice_status AS ENUM ('not_generated', 'sent', 'paid', 'overdue');
CREATE TYPE dataset_source AS ENUM ('NGOverse', 'LinkedIn', 'Manual', 'Referral', 'Other');

-- =============================================================================
-- TABLES
-- =============================================================================

-- ── 1. users ──────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id               uuid UNIQUE,                          -- links to auth.users
  email                 text NOT NULL UNIQUE,
  name                  text NOT NULL,
  role                  user_role NOT NULL DEFAULT 'sdr',
  phone                 text,
  calendar_link         text,
  monthly_demo_target   int DEFAULT 0,
  monthly_revenue_target numeric DEFAULT 0,
  monthly_base_salary   int,
  is_active             boolean DEFAULT true,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

-- ── 2. datasets ───────────────────────────────────────────────────────────────
CREATE TABLE datasets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  source        dataset_source NOT NULL,
  uploaded_by   uuid REFERENCES users(id),
  total_records int DEFAULT 0,
  notes         text,
  created_at    timestamptz DEFAULT now()
);

-- ── 3. organizations ──────────────────────────────────────────────────────────
CREATE TABLE organizations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id      uuid REFERENCES datasets(id),
  name            text NOT NULL,
  url             text,
  linkedin_url    text,
  location        text,
  thematic_areas  text[],
  annual_revenue  numeric,
  team_size       int,
  age_years       int,
  sql_score       int DEFAULT 0,
  sql_score_label text,
  icp_verified    boolean DEFAULT false,
  is_client       boolean DEFAULT false,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX organizations_name_trgm_idx ON organizations USING gin (name gin_trgm_ops);

-- ── 4. contacts ───────────────────────────────────────────────────────────────
CREATE TABLE contacts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name         text NOT NULL,
  designation  text,
  phone        text,
  email        text,
  linkedin_url text,
  is_primary   boolean DEFAULT false,
  is_verified  boolean DEFAULT false,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

-- ── 5. leads ──────────────────────────────────────────────────────────────────
CREATE TABLE leads (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  dataset_id     uuid REFERENCES datasets(id),
  lead_type      lead_type DEFAULT 'Outbound',
  assigned_to    uuid REFERENCES users(id),
  assigned_by    uuid REFERENCES users(id),
  status         lead_status NOT NULL DEFAULT 'new',
  phase          lead_phase NOT NULL DEFAULT 'sdr',
  interest_signal interest_signal,
  callback_date  date,
  follow_up_date date,
  recycle_date   date,
  recycle_reason text,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

-- ── 6. activities ─────────────────────────────────────────────────────────────
CREATE TABLE activities (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  org_id        uuid NOT NULL REFERENCES organizations(id),
  user_id       uuid NOT NULL REFERENCES users(id),
  activity_type activity_type NOT NULL,
  channel       text,
  outcome       text,
  notes         text,
  old_value     text,
  new_value     text,
  metadata      jsonb,
  created_at    timestamptz DEFAULT now()
);

-- ── 7. demos ──────────────────────────────────────────────────────────────────
CREATE TABLE demos (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id              uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  org_id               uuid NOT NULL REFERENCES organizations(id),
  sdr_id               uuid NOT NULL REFERENCES users(id),
  closer_id            uuid REFERENCES users(id),
  demo_date            timestamptz NOT NULL,
  sdr_summary          text NOT NULL,          -- min 50 chars enforced in app
  pain_point           text,
  demo_expectation     text,
  sdr_interest_signal  interest_signal,
  status               demo_status NOT NULL DEFAULT 'scheduled',
  post_demo_notes      text,
  handoff_at           timestamptz DEFAULT now(),
  calendar_invite_sent boolean DEFAULT false,
  reminder_sent        boolean DEFAULT false,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

-- ── 8. deals ──────────────────────────────────────────────────────────────────
CREATE TABLE deals (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demo_id           uuid REFERENCES demos(id),
  lead_id           uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  org_id            uuid NOT NULL REFERENCES organizations(id),
  closer_id         uuid NOT NULL REFERENCES users(id),
  stage             deal_stage NOT NULL DEFAULT 'demo_done',
  deal_value        numeric CHECK (deal_value IS NULL OR deal_value >= 30000),
  plan_type         text,
  next_follow_up    date,
  follow_up_count   int DEFAULT 0,
  first_demo_date   date,
  date_won_lost     date,
  sales_cycle_days  int,
  loss_reason       text,
  billing_name      text,
  billing_address   text,
  gst_number        text,
  invoice_status    invoice_status DEFAULT 'not_generated',
  payment_confirmed boolean DEFAULT false,
  onboarding_issued boolean DEFAULT false,
  removed_from_board boolean DEFAULT false,
  proposal_sent_at  timestamptz,
  poc_name          text,
  poc_designation   text,
  poc_phone         text,
  poc_email         text,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

-- ── 9. deal_comments ──────────────────────────────────────────────────────────
CREATE TABLE deal_comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id    uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id),
  comment    text NOT NULL,
  deal_stage text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ── 10. lead_comments (SDR private notes) ────────────────────────────────────
CREATE TABLE lead_comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id    uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment    text NOT NULL CHECK (char_length(comment) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX lead_comments_lead_id_idx ON lead_comments(lead_id);
CREATE INDEX lead_comments_created_at_idx ON lead_comments(lead_id, created_at DESC);

-- ── 11. dataset_ratings ───────────────────────────────────────────────────────
CREATE TABLE dataset_ratings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id    uuid NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES users(id),
  quality_score int CHECK (quality_score BETWEEN 1 AND 5),
  accuracy_score int CHECK (accuracy_score BETWEEN 1 AND 5),
  notes         text,
  created_at    timestamptz DEFAULT now(),
  UNIQUE(dataset_id, user_id)
);

-- ── 12. lead_assignments (history log) ───────────────────────────────────────
CREATE TABLE lead_assignments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id      uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  from_user_id uuid REFERENCES users(id),
  to_user_id   uuid NOT NULL REFERENCES users(id),
  assigned_by  uuid NOT NULL REFERENCES users(id),
  reason       text,
  created_at   timestamptz DEFAULT now()
);

-- ── 13. salary_targets (monthly lock history) ─────────────────────────────────
CREATE TABLE salary_targets (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month          int NOT NULL CHECK (month BETWEEN 1 AND 12),
  year           int NOT NULL,
  salary         numeric NOT NULL,
  demo_target    int NOT NULL DEFAULT 0,
  revenue_target numeric NOT NULL DEFAULT 0,
  locked_at      timestamptz DEFAULT now(),
  locked_by      uuid REFERENCES users(id),
  UNIQUE(user_id, month, year)
);

-- ── 14. commissions ──────────────────────────────────────────────────────────
CREATE TABLE commissions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id),
  deal_id         uuid REFERENCES deals(id),
  month           int NOT NULL,
  year            int NOT NULL,
  deal_value      numeric,
  plan_tier       text,
  achievement_pct numeric,
  commission_rate numeric,
  commission_amt  numeric,
  bonus_type      text,
  created_at      timestamptz DEFAULT now()
);

-- ── 15. lead_assignment_requests (SDR claims + enrichment) ────────────────────
CREATE TABLE lead_assignment_requests (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type      text NOT NULL,  -- 'lead_pool' | 'data_enrichment'
  org_id            uuid REFERENCES organizations(id),
  org_name_requested text,
  sdr_id            uuid NOT NULL REFERENCES users(id),
  sdr_notes         text,
  status            text NOT NULL DEFAULT 'pending',  -- pending|approved|rejected|fulfilled
  admin_note        text,
  reviewed_by       uuid REFERENCES users(id),
  reviewed_at       timestamptz,
  requested_at      timestamptz DEFAULT now()
);

-- =============================================================================
-- ROW LEVEL SECURITY — Enable on all tables
-- =============================================================================

ALTER TABLE users                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE datasets                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations             ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities                ENABLE ROW LEVEL SECURITY;
ALTER TABLE demos                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_comments             ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_comments             ENABLE ROW LEVEL SECURITY;
ALTER TABLE dataset_ratings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_assignments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_targets            ENABLE ROW LEVEL SECURITY;
ALTER TABLE commissions               ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_assignment_requests  ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

-- ── users ─────────────────────────────────────────────────────────────────────
CREATE POLICY "admin_all_users"         ON users FOR ALL    USING (get_user_role() = 'admin');
CREATE POLICY "users_see_self"          ON users FOR SELECT USING (auth_id = auth.uid() OR get_user_role() = ANY(ARRAY['admin'::user_role,'sales_ops'::user_role]));
CREATE POLICY "users_see_active_sdrs"   ON users FOR SELECT USING (role = 'sdr' AND is_active = true);
CREATE POLICY "users_see_active_closers" ON users FOR SELECT USING (role = 'closer' AND is_active = true);
CREATE POLICY "users_insert_own_profile" ON users FOR INSERT WITH CHECK (auth.uid() = auth_id);

-- ── datasets ──────────────────────────────────────────────────────────────────
CREATE POLICY "admin_all_datasets"  ON datasets FOR ALL    USING (get_user_role() = 'admin');
CREATE POLICY "datasets_read_all"   ON datasets FOR SELECT USING (true);

-- ── organizations ─────────────────────────────────────────────────────────────
CREATE POLICY "admin_all_orgs"            ON organizations FOR ALL    USING (get_user_role() = 'admin');
CREATE POLICY "orgs_read_all"             ON organizations FOR SELECT USING (true);
CREATE POLICY "authenticated_insert_orgs" ON organizations FOR INSERT WITH CHECK (true);
CREATE POLICY "sdr_update_organizations"  ON organizations FOR UPDATE
  USING (get_user_role() = 'sdr' AND EXISTS (SELECT 1 FROM leads l WHERE l.org_id = organizations.id AND l.assigned_to = get_user_id()))
  WITH CHECK (get_user_role() = 'sdr' AND EXISTS (SELECT 1 FROM leads l WHERE l.org_id = organizations.id AND l.assigned_to = get_user_id()));

-- ── contacts ──────────────────────────────────────────────────────────────────
CREATE POLICY "admin_all_contacts"        ON contacts FOR ALL    USING (get_user_role() = 'admin');
CREATE POLICY "contacts_read_all"         ON contacts FOR SELECT USING (true);
CREATE POLICY "authenticated_insert_contacts" ON contacts FOR INSERT WITH CHECK (true);
CREATE POLICY "sdr_update_contacts"       ON contacts FOR UPDATE
  USING (get_user_role() = 'sdr' AND EXISTS (SELECT 1 FROM leads l WHERE l.org_id = contacts.org_id AND l.assigned_to = get_user_id()))
  WITH CHECK (get_user_role() = 'sdr' AND EXISTS (SELECT 1 FROM leads l WHERE l.org_id = contacts.org_id AND l.assigned_to = get_user_id()));

-- ── leads ─────────────────────────────────────────────────────────────────────
CREATE POLICY "admin_all_leads"     ON leads FOR ALL    USING (get_user_role() = 'admin');
CREATE POLICY "sdr_select_leads"    ON leads FOR SELECT USING (assigned_to = get_user_id());
CREATE POLICY "sdr_insert_leads"    ON leads FOR INSERT WITH CHECK (get_user_role() = 'sdr' AND assigned_to = get_user_id());
CREATE POLICY "sdr_update_leads"    ON leads FOR UPDATE USING (assigned_to = get_user_id() AND phase = 'sdr') WITH CHECK (true);
CREATE POLICY "closer_insert_leads" ON leads FOR INSERT WITH CHECK (get_user_role() = 'closer');

-- ── activities ────────────────────────────────────────────────────────────────
CREATE POLICY "admin_all_activities"   ON activities FOR ALL    USING (get_user_role() = 'admin');
CREATE POLICY "sdr_all_activities"     ON activities FOR ALL    USING (user_id = get_user_id());
CREATE POLICY "closer_insert_activities" ON activities FOR INSERT WITH CHECK (user_id = get_user_id());

-- ── demos ─────────────────────────────────────────────────────────────────────
CREATE POLICY "admin_all_demos"    ON demos FOR ALL    USING (get_user_role() = 'admin');
CREATE POLICY "sdr_insert_demos"   ON demos FOR INSERT WITH CHECK (sdr_id = get_user_id());
CREATE POLICY "sdr_select_demos"   ON demos FOR SELECT USING (sdr_id = get_user_id());
CREATE POLICY "sdr_update_demos"   ON demos FOR UPDATE USING (sdr_id = get_user_id()) WITH CHECK (sdr_id = get_user_id());
CREATE POLICY "closer_all_demos"   ON demos FOR ALL    USING (closer_id = get_user_id());
CREATE POLICY "closer_insert_demos" ON demos FOR INSERT WITH CHECK (closer_id = get_user_id());

-- ── deals ─────────────────────────────────────────────────────────────────────
CREATE POLICY "admin_all_deals"      ON deals FOR ALL    USING (get_user_role() = 'admin');
CREATE POLICY "closer_all_deals"     ON deals FOR ALL    USING (closer_id = get_user_id());
CREATE POLICY "closer_reassign_deal" ON deals FOR UPDATE USING (closer_id = get_user_id()) WITH CHECK (true);
CREATE POLICY "sdr_insert_deals"     ON deals FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM demos WHERE demos.id = deals.demo_id AND demos.sdr_id = get_user_id()));

-- ── deal_comments ─────────────────────────────────────────────────────────────
CREATE POLICY "read_deal_comments"         ON deal_comments FOR SELECT USING (get_user_role() = ANY(ARRAY['admin'::user_role,'closer'::user_role]));
CREATE POLICY "closer_insert_deal_comments" ON deal_comments FOR INSERT WITH CHECK (user_id = get_user_id() AND EXISTS (SELECT 1 FROM deals d WHERE d.id = deal_comments.deal_id AND d.closer_id = get_user_id()));

-- ── lead_comments (SDR private notes) ────────────────────────────────────────
CREATE POLICY "sdr_read_own_lead_comments" ON lead_comments FOR SELECT
  USING (EXISTS (SELECT 1 FROM users u WHERE u.auth_id = auth.uid() AND u.role = 'sdr'
    AND EXISTS (SELECT 1 FROM leads l WHERE l.id = lead_comments.lead_id AND l.assigned_to = u.id)));
CREATE POLICY "sdr_write_own_lead_comments" ON lead_comments FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM users u WHERE u.auth_id = auth.uid() AND u.role = 'sdr'
    AND u.id = lead_comments.user_id
    AND EXISTS (SELECT 1 FROM leads l WHERE l.id = lead_comments.lead_id AND l.assigned_to = u.id)));
CREATE POLICY "admin_read_all_lead_comments" ON lead_comments FOR SELECT
  USING (EXISTS (SELECT 1 FROM users u WHERE u.auth_id = auth.uid() AND u.role = 'admin'));
CREATE POLICY "admin_write_lead_comments" ON lead_comments FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM users u WHERE u.auth_id = auth.uid() AND u.role = 'admin' AND u.id = lead_comments.user_id));

-- ── dataset_ratings ───────────────────────────────────────────────────────────
CREATE POLICY "admin_all_ratings" ON dataset_ratings FOR ALL    USING (get_user_role() = 'admin');
CREATE POLICY "sdr_own_ratings"   ON dataset_ratings FOR ALL    USING (user_id = get_user_id());

-- ── lead_assignments ──────────────────────────────────────────────────────────
CREATE POLICY "admin_all_assignments" ON lead_assignments FOR ALL    USING (get_user_role() = 'admin');
CREATE POLICY "sdr_insert_assignments" ON lead_assignments FOR INSERT WITH CHECK (assigned_by = get_user_id());

-- ── salary_targets ────────────────────────────────────────────────────────────
CREATE POLICY "admin_all_salary"  ON salary_targets FOR ALL    USING (get_user_role() = 'admin');
CREATE POLICY "sdr_own_salary"    ON salary_targets FOR SELECT USING (user_id = get_user_id());
CREATE POLICY "closer_own_salary" ON salary_targets FOR SELECT USING (user_id = get_user_id());

-- ── commissions ───────────────────────────────────────────────────────────────
CREATE POLICY "admin_all_commissions"  ON commissions FOR ALL    USING (get_user_role() = 'admin');
CREATE POLICY "sdr_own_commissions"    ON commissions FOR SELECT USING (user_id = get_user_id());
CREATE POLICY "closer_own_commissions" ON commissions FOR SELECT USING (user_id = get_user_id());

-- ── lead_assignment_requests ──────────────────────────────────────────────────
CREATE POLICY "sdr_insert_lead_requests" ON lead_assignment_requests FOR INSERT
  WITH CHECK (get_user_role() = 'sdr' AND sdr_id = get_user_id());
CREATE POLICY "sdr_read_own_requests"    ON lead_assignment_requests FOR SELECT
  USING (sdr_id = get_user_id() OR get_user_role() = 'admin');
CREATE POLICY "admin_update_requests"    ON lead_assignment_requests FOR UPDATE
  USING (get_user_role() = 'admin') WITH CHECK (get_user_role() = 'admin');

-- =============================================================================
-- NOTE: After running this schema, go to:
--   Authentication → Providers → Email → toggle on "Confirm email" OFF (for internal tool)
--   Authentication → Email Templates → customize if needed
--   Add the first admin user via: Authentication → Users → Add user (then set role in users table)
-- =============================================================================
