# DaanVeda CRM — Claude Code Context

This is the **DaanVeda CRM**: a full-stack internal CRM for a 10–15 person NGO sales team.
Built with Next.js 14 (App Router), TypeScript, Supabase, Tailwind CSS, and shadcn/ui.

---

## 🔑 Infrastructure (Already Provisioned)

| Service   | Detail |
|-----------|--------|
| Supabase  | Project: `daanveda-crm` · ID: `mflwubwzgcugesazlufm` · Region: ap-southeast-2 |
| Supabase URL | `https://mflwubwzgcugesazlufm.supabase.co` |
| Vercel    | Team: `prajwalmahajangits-projects` · Team ID: `team_Qzq66rEXJssCKSM5sGtrXKiZ` |
| Admin email | `prajwalmahajan54@gmail.com` |

**Database migrations already applied:** enums, extensions, all 10 tables, indexes, RLS policies.

---

## 🏗️ Tech Stack

- **Next.js 14** — App Router, TypeScript, `src/` directory, `@/*` import alias
- **Supabase** — PostgreSQL + Auth + Realtime + Edge Functions (all free tier)
- **Tailwind CSS + shadcn/ui** — component library, slate base color, CSS variables
- **@dnd-kit** — Kanban drag-drop
- **Recharts** — dashboard charts
- **Resend** — transactional email (100/day free)
- **date-fns** — date utilities
- **@tanstack/react-table** — data tables

---

## 🎨 Design System

```
Primary blue:  #1A56DB
Dark navy:     #0F172A
Background:    #F8FAFC
Green:         #059669
Amber:         #F59E0B
Red:           #EF4444
Text gray:     #64748B
Border:        #E2E8F0
Card:          #FFFFFF
Table header:  #F1F5F9
```

**UI Principles:**
- Clean, minimal, premium — information hierarchy over feature density
- Role-scoped: each user sees ONLY their workspace
- Max 2–3 clicks to complete any action
- Left sidebar (#0F172A) + top header bar layout
- KPI cards: white card, thin 6px left accent bar, uppercase 6.5pt labels
- Active nav: blue fill (#1A56DB), white text, subtle 0.04" colored accent line
- Status pills: outlined for OK/WARN; filled only for PIP/EXIT

---

## 👤 User Roles & Routing

| Role    | Workspace | Description |
|---------|-----------|-------------|
| admin   | `/admin`  | Full visibility, user/target management, dataset upload, no lead input |
| sdr     | `/sdr`    | Assigned leads, activity logging, demo booking |
| closer  | `/closer` | Demos, Kanban pipeline, follow-ups, commission view |

**Middleware** (`src/middleware.ts`): Auth check → role check → route to workspace.

---

## 🗄️ Database Schema (10 Tables)

All tables have RLS enabled. Helper function `get_user_role()` reads role from JWT.

### Table Summary
1. **users** — team members (auth_id links to Supabase Auth)
2. **datasets** — uploaded lead datasets (source: NGOverse/LinkedIn/Manual/Referral/Other)
3. **organizations** — NGO/company records with ICP scoring (sql_score 0–8)
4. **contacts** — KDMs (Key Decision Makers) linked to organizations
5. **leads** — lifecycle record per org (phases: sdr → closer → recycled/converted/dead)
6. **activities** — immutable audit log (never updated, only inserted)
7. **demos** — demo bookings (sdr_id = immutable attribution for SDR bonuses)
8. **deals** — Closer pipeline (deal_value ≥ ₹30,000 enforced)
9. **dataset_ratings** — SDR quality ratings per dataset (1 per SDR per dataset)
10. **lead_assignments** — assignment history log
11. **salary_targets** — monthly salary/target lock history per user
12. **commissions** — commission calculation records

### Key Enums
```sql
user_role: admin | sdr | closer | sales_ops
lead_status: new | assigned | contacted | call_again | hot | demo_booked |
             not_interested | not_reachable | recycled |
             demo_done | proposal_sent | follow_up | negotiation |
             won | lost | ghosted | converted
lead_phase: sdr | closer | recycled | converted | dead
interest_signal: hot | warm | cold | dead
demo_status: scheduled | attended | no_show | rescheduled | cancelled
deal_stage: demo_done | proposal_sent | follow_up | negotiation |
            won | lost | ghosted | invoice_sent | converted
activity_type: call | email | linkedin | whatsapp | note | status_change |
               assignment | demo_booked | follow_up | dataset_rating
```

### RLS Rules
- **Admin**: full access to all tables
- **SDR**: own leads only (assigned_to = their id), own activities
- **Closer**: own demos and deals (closer_id = their id)
- **Everyone**: can read organizations and contacts

---

## 🔄 Critical Business Logic

### Lead Lifecycle State Machine
```
Dataset Upload → Lead Pool (unassigned)
  → Admin assigns → SDR Workspace (phase=sdr)
    → SDR books demo → Closer Workspace (phase=closer, status=demo_booked)
      → Deal Won → phase=converted
      → Deal Lost → phase=dead or recycled
    → SDR marks not_interested/lost → recycled pool
      → Re-assigned → back to SDR Workspace
```

### Demo Booking (POST /api/demos)
1. Validate `sdr_summary.length >= 50` — MANDATORY, block submit if empty
2. Assign to next available Closer (round-robin: fewest active demos)
3. Create demo record — `sdr_id` is IMMUTABLE (never changes, used for attribution)
4. Create deal record (stage = demo_done)
5. Update lead: status = demo_booked, phase = closer, assigned_to = closer_id
6. Log activity (type = demo_booked)
7. Insert lead_assignment record
8. Realtime notification to Closer via Supabase

### Commission Engine (Two-Dimensional)
- **Axis 1 — Plan Tier** (deal value):
  - ₹30K–₹60K: Base rate
  - ₹60K–₹1.2L: Mid rate
  - ₹1.2L+: Premium rate
- **Axis 2 — Achievement %** (monthly revenue vs target):
  - <70%: No commission
  - 70–99%: Standard rate
  - 100–119%: Bonus rate
  - 120%+: Accelerator rate

### SDR Metrics (Pace-First Design)
- Working days: Monday–Saturday = 26 days/month
- Daily pace = monthly target ÷ 26
- Pace indicator updates every 15 minutes (pg_cron)
- Daily target bar is the HERO element on SDR dashboard (not monthly aggregate)

### Salary & Target Lock
- Locked monthly at month start
- Mid-month change = retroactive to month 1
- Historical data preserved in `salary_targets` table
- Manager can change target — affects current month pace immediately

### PIP System
- Floor = 60% of assigned monthly target (dynamic)
- Manager-only visibility (hidden from SDR)
- Manager can manually override PIP status (VIP override capability)
- PIP triggers when performance < floor for 2+ consecutive months

### Quarterly Bonus
- Average of 3 months' achievement %
- Checked by pg_cron on last day of quarter
- Separate bonus record in `commissions` table

### Attribution Chain
- `demos.sdr_id` = IMMUTABLE — always the SDR who booked the demo
- SDR conversion bonus triggered when deal.stage = 'won'
- Closer cannot edit `sdr_summary` (read-only after booking)

---

## 📂 File Structure to Build

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx          — Email + password login
│   │   └── layout.tsx              — Centered card layout
│   ├── (dashboard)/
│   │   ├── admin/
│   │   │   ├── page.tsx            — Admin dashboard (leaderboard, funnel, KPIs)
│   │   │   ├── datasets/page.tsx   — Dataset list + bulk upload
│   │   │   ├── leads/page.tsx      — Lead pool + assignment
│   │   │   └── team/page.tsx       — User management + target setting
│   │   ├── sdr/
│   │   │   ├── page.tsx            — SDR dashboard (PACE BAR as hero KPI)
│   │   │   ├── leads/page.tsx      — Assigned leads + LeadDetailPanel
│   │   │   └── followups/page.tsx  — Follow-up queue (overdue/today/upcoming)
│   │   ├── closer/
│   │   │   ├── page.tsx            — Closer dashboard (commission zone as hero)
│   │   │   ├── pipeline/page.tsx   — Kanban board with dnd-kit
│   │   │   ├── today/page.tsx      — Today's demos + follow-ups
│   │   │   └── past/page.tsx       — Won/Lost/All history
│   │   └── layout.tsx              — Sidebar + topbar shell (role-aware)
│   ├── api/
│   │   ├── leads/route.ts          — GET (filtered list), POST (create)
│   │   ├── leads/[id]/route.ts     — GET (detail + timeline), PATCH
│   │   ├── leads/[id]/assign/route.ts
│   │   ├── activities/route.ts     — POST (log activity)
│   │   ├── demos/route.ts          — POST (book demo + handoff)
│   │   ├── demos/[id]/route.ts     — PATCH (update demo)
│   │   ├── deals/route.ts          — GET (closer pipeline)
│   │   ├── deals/[id]/route.ts     — PATCH (update deal stage)
│   │   ├── datasets/route.ts       — GET, POST
│   │   ├── datasets/upload/route.ts — POST (CSV parse + bulk insert)
│   │   ├── users/route.ts          — GET, POST (invite)
│   │   ├── users/[id]/route.ts     — PATCH (role, targets)
│   │   └── email/daily-summary/route.ts — Resend daily summary
│   ├── layout.tsx                  — Root layout
│   └── page.tsx                    — Redirect to /login
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx             — Dark navy, role-aware nav
│   │   └── TopBar.tsx              — Header: page title + user avatar + topbar context
│   ├── leads/
│   │   ├── LeadCard.tsx
│   │   ├── LeadDetailPanel.tsx     — shadcn Sheet, tabs: Overview/Timeline/Contacts
│   │   ├── LeadTimeline.tsx
│   │   ├── LogActivityModal.tsx    — Channel, Outcome, Interest Signal, Notes
│   │   └── BookDemoModal.tsx       — sdr_summary MANDATORY (≥50 chars)
│   ├── pipeline/
│   │   ├── KanbanBoard.tsx         — dnd-kit drag-drop
│   │   ├── KanbanColumn.tsx
│   │   └── DealCard.tsx
│   ├── dashboard/
│   │   ├── KpiCard.tsx             — White card + 6px left accent bar
│   │   ├── FunnelChart.tsx
│   │   ├── BarChart.tsx
│   │   └── Leaderboard.tsx         — Manager view: sorted by risk (PIP first)
│   └── upload/
│       └── BulkUploadTable.tsx     — CSV paste → column mapper → dedup → confirm
├── lib/
│   ├── supabase/
│   │   ├── client.ts               — createBrowserClient()
│   │   ├── server.ts               — createServerClient() for API routes
│   │   └── middleware.ts           — createMiddlewareClient()
│   ├── utils.ts                    — cn(), formatCurrency(), formatDate()
│   └── constants.ts                — Statuses, signals, channels
├── types/
│   └── database.ts                 — Full TypeScript types for all 12 tables
└── middleware.ts                   — Auth + role-based routing
```

---

## ⚙️ Environment Variables

File: `.env.local` (never commit to git)

```
NEXT_PUBLIC_SUPABASE_URL=https://mflwubwzgcugesazlufm.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mbHd1Ynd6Z2N1Z2VzYXpsdWZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MTUyNzIsImV4cCI6MjA4ODk5MTI3Mn0.xEOhUiy-3FIRwn3m6m964Z1JyRp8Mtz2E2VqKxjPyEQ
SUPABASE_SERVICE_ROLE_KEY=<get from Supabase > Settings > API > service_role key>
RESEND_API_KEY=<get from resend.com/api-keys>
RESEND_FROM_EMAIL=noreply@daanveda.com
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=DaanVeda CRM
```

---

## 🤖 pg_cron Automations (Apply in Supabase SQL Editor)

```sql
-- Daily 9AM IST (3:30 AM UTC) — resurface follow-ups
select cron.schedule('resurface-followups', '30 3 * * *', $$
  update leads set status = 'call_again'
  where follow_up_date = current_date
  and status not in ('demo_booked','won','converted','lost');
$$);

-- Daily 9AM IST weekdays — morning summary email
select cron.schedule('morning-summary-email', '30 3 * * 1-6', $$
  select net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/send-daily-summary',
    headers := json_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key'))::jsonb,
    body := '{"type": "morning"}'::jsonb
  );
$$);

-- Daily 1AM UTC — recycle overdue leads
select cron.schedule('recycle-leads', '0 1 * * *', $$
  update leads set status = 'recycled', phase = 'recycled'
  where recycle_date <= current_date
  and status in ('not_interested','ghosted','lost')
  and phase != 'recycled';
$$);
```

---

## 🚀 Build Order

Build exactly in this sequence (each step depends on the previous):

1. `types/database.ts` — all TypeScript interfaces
2. `lib/supabase/` — client, server, middleware
3. `lib/utils.ts` + `lib/constants.ts`
4. `src/middleware.ts` — auth + role routing
5. Root layout + login page
6. Dashboard shell layout (Sidebar + TopBar)
7. Admin: Team management
8. Admin: Datasets + bulk upload
9. Admin: Lead Pool + assignment
10. Admin: Dashboard
11. SDR: Leads page (with LeadDetailPanel, LogActivityModal, BookDemoModal)
12. SDR: Follow-ups page
13. SDR: Dashboard (pace bar as hero)
14. Closer: Today's Actions
15. Closer: Kanban Pipeline
16. Closer: Dashboard (commission zone as hero)
17. Closer: Past Context
18. All API routes
19. Email route (Resend daily summary)

---

## ⚠️ Critical Constraints

1. NO WhatsApp integration
2. NO Slack integration
3. NO Razorpay or invoicing
4. NO paid APIs
5. Deal values must be ≥ ₹30,000 (DB check constraint)
6. SDR cannot edit a lead after phase = closer
7. Closer cannot edit sdr_summary (read-only)
8. Loss reason MANDATORY when deal_stage = lost
9. Billing details MANDATORY when deal_stage = won
10. sdr_summary minimum 50 characters (enforced in BookDemoModal)
11. `demos.sdr_id` is IMMUTABLE — never reassign after booking
12. Working days = Mon–Sat (26/month) for pace calculations

---

## 🔍 Current Build Status

- [x] Architecture finalized
- [x] UX design finalized (v3 HoP — 20 slides)
- [x] Database schema created in Supabase (migrations applied)
- [x] Infrastructure provisioned (Supabase + Vercel + Git)
- [ ] Next.js project scaffolded
- [ ] Source files written
- [ ] Deployed to Vercel

**Reference files in this repo:**
- `DaanVeda_CRM_System_Architecture.docx` — Full 8-section architecture
- `DaanVeda_CRM_Build_Guide.docx` — SQL schema, env vars, build order, Claude Code prompt
- `DaanVeda_CRM_UX_v3_HoP.pptx` — Definitive 20-slide UI/UX reference (HEAD OF PRODUCT design)
