# DaanVeda CRM — Project State (shared brain)

> **This folder is the single source of truth shared across every machine and every
> Claude session, synced through GitHub.** Read this + `DECISIONS.md` + `CHANGELOG.md`
> at the start of every session. Update `STATE.md` + append `CHANGELOG.md` BEFORE every
> push. Also read the repo-root `CLAUDE.md` (technical reference: schema, routes, design).
>
> Last updated: 2026-07-22.

## What this is
Internal, **live production** sales CRM for DaanVeda's ~15-person NGO sales team.
Next.js 14 (App Router, TypeScript, `src/`, `@/*` alias) + Supabase (Postgres + Auth +
RLS, no Realtime) + Tailwind + @dnd-kit (Kanban) + lucide-react + Recharts.
Three role-scoped workspaces: **Admin / SDR / Closer**. In active daily use.

## Team (active users, as of 2026-07-22)
- Admin (1): DaanVeda Admin (sales@daanveda.com)
- SDRs (6): Laxmi (sdr1@), Adhyaa Malik (sdr2@), Nehal Jain (sdr3@), Anshika (care@),
  Harshit (harshit@), Megha Shruti (tanishq@)
- Closers (8): Anurag, Himanshu Singhal, Irfan, Kaif, Megha, Muskan, Sudhir S Kumar
- NOTE: several SDR login emails are aliases (sdr1@/sdr2@/care@/tanishq@) — relevant if
  we ever send email digests (may need a separate notification_email).

## Infrastructure
- **GitHub:** `DaanVedaSales/daanveda-crm` (remote is SSH: `git@github.com:DaanVedaSales/daanveda-crm.git`).
  Repo is currently PUBLIC (worth revisiting for a CRM).
- **Supabase (PRODUCTION, no staging):** project ref `qtmkjxtjtpqeizvqiubu` (ap-south-1).
  Reads freely via the Supabase tool. **Flag clearly + get an explicit nod before ANY
  write/migration — it hits live data.** `.env.local` still has an old `qufx…` ref (ignore).
- **Vercel:** team "DaanVeda's projects" (`team_OH5Gtg2yUgHaoETQJOFK2US7`), project
  `daanveda-crm`. Auto-deploys production on push to `main`. Likely on the FREE/Hobby
  tier → Vercel caps cron jobs (≈2); keep that in mind before adding crons.
- **Deploy flow:** Claude edits + commits locally (only intended files, never `git add -A`)
  → the human runs `git push origin main` from their terminal → GitHub → Vercel auto-deploys.
  **Claude never pushes.**
- `next.config.js` has `ignoreBuildErrors:true` + `ignoreDuringBuilds:true` → TS/ESLint
  errors never block deploys.

## Current status
- Repo HEAD (as of this writing): `4b65c94`. All work below is committed AND pushed/live
  unless a CHANGELOG entry says "awaiting push".
- Everything is live and stable. No known breakage.

## Build conventions (READ before coding)
- **tsc gate:** run `NODE_OPTIONS=--max-old-space-size=6144 npx tsc --noEmit` (plain
  `npx tsc` OOMs). The bar is **"no NEW error classes vs HEAD"**, not a clean tsc. The
  repo has pervasive PRE-EXISTING untyped-Supabase-client noise: `TS2339 / TS2345 /
  TS2769` ("… on type 'never'"). Prove new work is clean by comparing per-file error
  COUNT to HEAD (git stash → count → pop) and confirming any added errors are that same
  noise class. Custom RPCs / tables not in the stale generated `types/database.ts` →
  cast the client `as any` (established idiom).
- **IST everywhere:** helpers in `src/lib/utils.ts` (`getNowIST`, `toISTDateString`,
  `istDayStart/End`, `IST_TIMEZONE`, and client-side `formatIST`). Never set Vercel `TZ`.
- **Scale rule:** an unbounded `.select()` returns only ~1000 rows (Supabase cap). Full
  lists → `fetchAllRows()` in `src/lib/supabase/paginate.ts`; counts → `{ count:'exact',
  head:true }`. Avoid "load everything into the browser then filter" patterns.
- **Standing rule — dashboard/metrics audit:** every change touching lead
  `status`/`phase`/dates/`returned_reason` or inserting `activities` MUST include a
  dashboard & metrics impact check (SDR/Admin/Closer dashboards, `/api/admin/funnel`,
  `/api/team/stats`, daily-summary). Lead-count KPIs read status/phase; demo/deal/
  commission metrics read demos/deals.
- **Commit messages** end with: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- `src/lib/supabase/` may be OS-permission-locked from reading in some sandboxes — work
  around it (the client patterns are documented in CLAUDE.md).

## Recently shipped (see CHANGELOG.md for the full list + commit hashes)
- **In-app notifications (P3a)** — bell dropdown in the TopBar (unread badge, grouped
  Today/Earlier, mark-all-read, click-to-deep-link, 60s polling, no sockets). New
  `notifications` table (RLS: each user sees/updates only their own; inserts service-role
  only). Best-effort `src/lib/notifications.ts` helper (`notify`/`notifyMany`/`notifyRole`
  — never throws). 9 cross-workspace events wired (demo booked→closer, no-show→SDR,
  reschedule→counterpart, closer-reassign→new closer, lead-returned→SDR, admin-assign→SDR,
  claim decision→SDR, deal-won→admins, ban-requested→admins).
- **Closer ban-request** — Ban button in the Kanban DealPanel (next to delete). Mirrors
  the SDR "Banned" flow: `POST /api/deals/[id]/ban-request` soft-deletes the deal+demo and
  routes the lead to the admin Ban Requests pool (phase=dead, returned_reason=ban_requested);
  admin confirms (is_banned stays admin-only). Notifies admins.
- **Notification 30-day auto-cleanup** — `src/lib/maintenance.ts` `cleanupOldNotifications()`
  (deletes notifications >30 days, read or unread; best-effort) triggered from the existing
  daily `/api/cron/sheet-sync` cron (NOT a new cron entry, to respect the Vercel cron cap).
- **UniSheet sync (BUILT, currently PARKED)** — one-way push of a unified per-lead journey
  row to DaanVeda's own UniSheet product. See "Parked / pending" below.
- Earlier: org-search ghost-bug fix, admin funnel is_deleted correction, Laxmi My Leads
  scale fix, SDR KDM/follow-up batch, Closer feedback batch, commission+funnel model,
  banned-orgs infra, admin feature batch. (Details in CHANGELOG.md + CLAUDE.md.)

## Parked / pending (deliberate "later" items — nothing broken)
- **UniSheet sync — blocked on a UniSheet-side bug.** Code is live; the `UNISHEET_WEBHOOK_URL`
  env var was removed from Vercel so it sits idle. UniSheet's webhook has an insert bug
  (every new row lands on the same grid row and overwrites the previous) + a >15s response
  latency from Vercel + a broken `records` batch. Reported to the UniSheet team. When fixed:
  re-add `UNISHEET_WEBHOOK_URL` in Vercel → the ~2,958 queued leads backfill automatically.
  DB side is fully applied (moddatetime triggers, dirty-queue tables, row-builder functions).
- **Notification/email digests (Resend)** — approved plan, not built. Resend (not Instantly),
  deterministic templates, morning "to-do" + evening "performance" per role, Vercel cron.
  Blocked on: reconnecting the Resend MCP with fuller access, verifying a sending domain
  (recommended: subdomain `crm.daanveda.com` to avoid Workspace/Instantly DNS collisions),
  and the alias-inbox decision. Dormant route `/api/email/daily-summary` exists to extend.
- **Converting-later reminders** — notify a closer when a `deals.stage='converting_later'`
  committed date (`next_follow_up`) hits. Needs a daily cron; folds into `maintenance.ts`.
  Live data 2026-07-22: 80 converting_later deals, 11 already overdue → real value.
- Notification P3b: SDR-request→admin, enrichment-fulfilled→SDR, per-user mute, "View all"
  page, time-based reminders (demo-soon, follow-up-overdue).
- My Leads pagination (Phase 3b) — only when an SDR nears ~1,000 leads.
- SDR trash-button workflow; near-duplicate orgs dedup; Lead Pool "All" filter tidy-up.
- Google Calendar integration + Supabase→external incremental export (both fully
  brainstormed; see DECISIONS.md / prior context).

## How we work (firm)
- **Recommendation-first.** On any feature/bug: analyze end-to-end vs real code + live data,
  give root cause / plan / dependencies / risks / scale + dashboard impact, ask questions,
  and WAIT for an explicit "go ahead" before building.
- Build in small verified phases, one shippable commit each; the human pushes + verifies
  before the next.
- Strict scope: only the agreed change + true dependencies. Never touch/"improve" anything
  unrelated. Preserve all functionality — nothing lost. No data loss ever (additive /
  soft-delete; get a nod before prod DB writes).
- Update `STATE.md` + `CHANGELOG.md` BEFORE every push.
