# DaanVeda CRM — Claude Code Context

> **This file is the single source of truth for any AI assistant working on this project.**
> Read this fully before making any changes.

---

## What This Is

An internal CRM for DaanVeda's 10–15 person NGO sales team. Built as a Next.js 14 web app
backed by Supabase. Three role-scoped workspaces: Admin, SDR (outbound callers), Closer
(demo → deal closers). The product is fully functional and in active use.

---

## Infrastructure

| Service   | Detail |
|-----------|--------|
| Supabase  | Company project (replace with new project ID after migration) |
| Vercel    | Company team (replace with new team after migration) |
| GitHub    | Company org repo (replace with new repo URL after migration) |
| Domain    | TBD |

**The schema lives in `supabase/schema.sql`** — run this on any new Supabase project.

---

## Tech Stack

- **Next.js 14** — App Router, TypeScript, `src/` directory, `@/*` alias
- **Supabase** — PostgreSQL + Auth + Row Level Security (no Realtime in use)
- **Tailwind CSS** — no build-time purge issues; utility classes only
- **@dnd-kit** — Kanban drag-drop on Closer pipeline
- **Lucide React** — icons throughout
- **Recharts** — charts on dashboards

### Supabase client pattern (critical)
```ts
// For API routes that need auth-scoped data (respects RLS):
import { createClient } from '@/lib/supabase/server'
const supabase = createClient()

// For API routes that need to bypass RLS (admin reads, service ops):
import { createServiceClient } from '@/lib/supabase/server'
const supabase = createServiceClient()

// In client components:
import { createClient } from '@/lib/supabase/client'
```

---

## Design System

```
Primary blue:  #1A56DB
Dark navy:     #0F172A   (sidebar background)
Background:    #F8FAFC
Border:        #E2E8F0
Card:          #FFFFFF
Table header:  #F1F5F9
Text dark:     #0F172A
Text muted:    #64748B
Text lighter:  #94A3B8
Green:         #059669
Amber:         #F59E0B
Red:           #EF4444
```

**UI rules:**
- No emojis in production UI
- Minimal headers/bullets — clean prose layout in panels
- Status pills: small, rounded-full, text-[10px], colored bg
- Cards: white, border-[#E2E8F0], rounded-xl, shadow-sm
- Form inputs: border-[#E2E8F0], rounded-lg, focus:ring-2 focus:ring-[#1A56DB]/20
- All modals: fixed inset-0 bg-black/40 z-50, centered card, max-w-md

---

## Role-Based Routing

| Role   | Prefix    | Can see |
|--------|-----------|---------|
| admin  | /admin    | Everything — all data, all users, datasets, team mgmt |
| sdr    | /sdr      | Only their assigned leads, their own demos/followups |
| closer | /closer   | Only their demos and deals (Kanban pipeline) |

**Middleware** (`src/middleware.ts`): checks auth → reads role from `users` table → redirects
to correct workspace prefix. If no profile row exists, redirects to `/login`.

---

## Database (15 Tables)

See `supabase/schema.sql` for the complete DDL including all RLS policies.

### Tables
1. **users** — team members; `auth_id` links to Supabase Auth
2. **datasets** — uploaded lead batches (source: NGOverse/LinkedIn/Manual/Referral/Other)
3. **organizations** — NGO/company records with SQL score (0–8), thematic areas, `is_client` flag
4. **contacts** — KDMs per org; `is_primary` = the main decision maker
5. **leads** — one per org assignment; phases: sdr → closer → recycled/converted/dead
6. **activities** — immutable audit log; never update, only insert
7. **demos** — created when SDR books demo; `sdr_id` is IMMUTABLE (attribution)
8. **deals** — created alongside demo; Closer's Kanban card
9. **deal_comments** — Closer's private notes on a deal (visible to closer + admin)
10. **lead_comments** — SDR's private notes on a lead (visible only to that SDR + admin)
11. **dataset_ratings** — SDR quality scores per dataset (1 per SDR per dataset)
12. **lead_assignments** — immutable assignment history log
13. **salary_targets** — monthly lock history (salary + targets per user per month)
14. **commissions** — commission calculation records
15. **lead_assignment_requests** — SDR claims from lead pool + data enrichment requests

### Key enums
```
lead_status:   new | assigned | contacted | call_again | hot | demo_booked |
               not_interested | not_reachable | recycled | demo_done |
               proposal_sent | follow_up | negotiation | won | lost | ghosted | converted
lead_phase:    sdr | closer | recycled | converted | dead
deal_stage:    demo_scheduled | demo_done | unqualified | proposal_sent | follow_up |
               negotiation | won | lost | ghosted | invoice_sent | converted
interest_signal: hot | warm | cold | dead
demo_status:   scheduled | attended | no_show | rescheduled | cancelled
```

### RLS helper functions
Two SQL functions exist in the database:
- `get_user_role()` — returns the role of the authenticated user
- `get_user_id()` — returns the `users.id` (not auth_id) of the authenticated user

---

## What's Actually Built (Complete Feature List)

### Admin workspace (`/admin`)
- **Dashboard** — KPI cards (total leads, demos booked, deals won/lost, pipeline value),
  team leaderboard, funnel chart, SDR pace overview, unqualified % per closer
- **Datasets** (`/admin/datasets`) — upload via CSV file or paste-grid (Excel-style);
  25-column grid with rectangular drag-select cell ranges, row-number select, Ctrl+C/X/V;
  auto column mapping; bulk upsert API; dataset history list with export button
- **Lead Pool** (`/admin/leads`) — two tabs: Pool + Claims
  - Pool tab: all leads with checkbox column (drag-select supported), bulk-assign to SDR,
    individual assign/reassign dropdowns, delete org button, filter unassigned/all
  - Claims tab: SDR lead_pool claims + data_enrichment requests; admin approve/reject with note
- **Team** (`/admin/team`) — two tabs: Members + Statistics
  - Members: invite user, set role/targets/salary, deactivate, reassign leads on deactivate
  - Statistics: monthly stats per SDR/Closer (demos, deals, conversion %, unqualified %)

### SDR workspace (`/sdr`)
- **Dashboard** — pace bar (daily hero KPI), demos booked, interest signal breakdown
- **My Leads** (`/sdr/leads`) — assigned leads list (excludes demo_booked/call_again/not_reachable)
  - Search by org name, location, status, KDM contact name, phone
  - Detail panel (right side) with tabs: Overview | Comments | Contacts
  - Comments tab: private SDR notes (latest first, ⌘Enter to post, only SDR + admin can see)
  - Quick actions: Log Activity, Book Demo
  - Modals: Add Lead (creates org + KDM + lead), Edit Lead (org + KDM fields), Log Activity, Book Demo
- **Follow-ups** (`/sdr/followups`) — callback queue grouped by Overdue/Today/Upcoming/No Date
  - Each row expands to show KDM contact card + last 5 activities
- **My Demos** (`/sdr/demos`) — booked demos grouped by time bucket
  - Each card has Details expand: pain_point, demo_expectation, KDM contact, activity log
  - Reminder tracking (Mark Reminded button)

### Closer workspace (`/closer`)
- **Dashboard** — commission zone hero (achievement vs target), deal pipeline summary
- **Kanban Pipeline** (`/closer/pipeline`) — dnd-kit drag-drop across deal stages
  - DealPanel (right slide-in): org overview, structured SDR context (pain point + demo expectation),
    POC section, deal value, billing details, comments feed (visible to closer + admin)
  - Proposal Sent button inline on demo_done cards
  - Stage progression with loss_reason enforcement on lost, billing enforcement on won
- **Today's Actions** (`/closer/today`) — today's demos + follow-ups
  - Demo cards show full SDR context; expandable with org details + KDM
- **Past Context** (`/closer/past`) — won/lost/ghosted deal history

### Org Search (shared modal across SDR + Closer)
- Full-text + trigram search across all organizations
- Status derivation per org: active_client | in_pipeline | demo_booked | with_sdr |
  claim_pending | in_lead_pool | in_database | lost | ghosted
- SDR sees Claim button for unassigned orgs (in_lead_pool or in_database)
- Shows "Claimed · Pending" with SDR name if org already has a pending claim
- Data enrichment form: org details + KDM contact → sends request to admin for review

---

## Critical Business Rules

1. `demos.sdr_id` is **IMMUTABLE** — never change after booking; used for attribution
2. `sdr_summary` is mandatory on demo booking (≥ 50 chars enforced in UI)
3. SDR cannot edit a lead after `phase = closer`
4. Closer cannot see or edit `sdr_summary`
5. `loss_reason` mandatory when deal_stage = 'lost'
6. Billing fields mandatory when deal_stage = 'won'
7. Deal value ≥ ₹30,000 enforced via DB check constraint
8. Working days = Mon–Sat = 26/month for pace calculations
9. `createServiceClient()` must be used for org search API (so all roles see same statuses)

---

## API Routes

All under `src/app/api/`:

| Route | Methods | Notes |
|-------|---------|-------|
| `/activities` | POST | Log activity on a lead |
| `/closers` | GET | List active closers (for SDR Book Demo) |
| `/contacts/[id]` | PATCH | Update contact |
| `/datasets` | GET, POST | List + create dataset |
| `/datasets/upload` | POST | Bulk upsert orgs + contacts from grid/CSV |
| `/deals` | GET | Closer pipeline (with org + demo context) |
| `/deals/[id]` | PATCH | Update deal stage, billing, POC, value |
| `/deals/comments` | GET, POST | Deal comments feed |
| `/demos` | POST | Book demo (creates demo + deal + reassigns lead) |
| `/demos/[id]` | PATCH | Update demo (reschedule, reminder_sent, etc.) |
| `/leads` | GET | Filtered list (by assigned_to, phase, etc.) |
| `/leads/[id]` | GET | Lead detail + activities + contacts |
| `/leads/[id]/assign` | POST | Assign/reassign lead |
| `/leads/comments` | GET, POST | SDR private comments (scoped by lead_id) |
| `/leads/manual` | POST | SDR manually adds a lead (creates org + contact + lead) |
| `/lead-requests` | GET, POST | Create + list SDR claim/enrichment requests |
| `/lead-requests/[id]` | PATCH | Admin approve/reject (auto-creates lead on approval) |
| `/organizations/[id]` | PATCH, DELETE | Update or delete org |
| `/organizations/search` | GET | Fuzzy search with status derivation (uses serviceClient) |
| `/team/stats` | GET | Admin dashboard statistics |
| `/users` | GET, POST | List users + invite new user |
| `/users/[id]` | PATCH | Update user (role, targets, salary, active status) |
| `/admin/export` | GET | Full data export as CSV |

---

## File Structure (Actual)

```
src/
├── app/
│   ├── (auth)/login/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx                    — Sidebar + TopBar shell
│   │   ├── admin/
│   │   │   ├── page.tsx                  — Admin dashboard
│   │   │   ├── datasets/page.tsx         — Dataset upload + grid
│   │   │   ├── leads/page.tsx            — Lead pool + claims
│   │   │   └── team/page.tsx             — Team management + stats
│   │   ├── sdr/
│   │   │   ├── page.tsx                  — SDR dashboard (pace)
│   │   │   ├── leads/page.tsx            — My leads + detail panel + comments
│   │   │   ├── followups/page.tsx        — Follow-up queue (expandable)
│   │   │   └── demos/page.tsx            — Booked demos (expandable)
│   │   └── closer/
│   │       ├── page.tsx                  — Closer dashboard
│   │       ├── pipeline/page.tsx         — Kanban + DealPanel
│   │       ├── today/page.tsx            — Today's demos + follow-ups
│   │       └── past/page.tsx             — Deal history
│   ├── api/                              — All API routes (see table above)
│   ├── layout.tsx
│   └── page.tsx                          — Redirect to /login
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   └── TopBar.tsx
│   ├── crm/
│   │   ├── OrgSearchInput.tsx            — Inline org search-as-you-type input
│   │   └── OrgSearchModal.tsx            — Full org search modal (shared SDR+Closer)
│   └── ui/
│       └── DateTimePicker.tsx            — Custom datetime picker
├── lib/
│   ├── supabase/
│   │   ├── client.ts                     — Browser client
│   │   ├── server.ts                     — Server client (createClient + createServiceClient)
│   │   └── middleware.ts                 — Middleware client
│   ├── utils.ts                          — cn(), formatDate(), formatRelativeDate()
│   └── constants.ts                      — LEAD_STATUS_LABELS/COLORS, INTEREST_SIGNAL_*, etc.
├── types/
│   └── database.ts                       — TypeScript types for all tables
└── middleware.ts                         — Auth + role routing
```

---

## Environment Variables

File: `.env.local` (never commit — add to `.gitignore`)

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-id>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from Supabase Settings → API>
SUPABASE_SERVICE_ROLE_KEY=<service_role key from Supabase Settings → API>
NEXT_PUBLIC_APP_URL=https://<your-vercel-domain>
NEXT_PUBLIC_APP_NAME=DaanVeda CRM
```

---

## Git & Deployment Notes

- **Never** use `git add` or `git commit` from within a Cowork/container session — virtiofs
  causes lock file issues. Always push from the developer's local Mac terminal:
  ```
  cd /path/to/daanveda-crm && git push origin main
  ```
- Vercel auto-deploys on push to `main`
- Set all env vars in Vercel → Project Settings → Environment Variables

---

## Things NOT in This Codebase

- No WhatsApp integration
- No Slack integration
- No Razorpay / payment processing
- No SMS
- No pg_cron automations yet (schema comment has the SQL if needed)

---

## How to Add a New Feature (Working Pattern)

1. Read this file fully first
2. Check if a DB migration is needed — if yes, run via Supabase MCP or SQL Editor
3. Create/update API route in `src/app/api/`
4. Create/update the page or component
5. Test locally (`npm run dev`)
6. Push from Mac terminal
