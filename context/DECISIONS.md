# DaanVeda CRM — Locked Decisions

Durable product/technical decisions already made. Don't re-litigate; extend only with
the owner's agreement. Newest at the bottom of each section.

## Workflow & collaboration
- Two contributors (owner Prajwal + assistant), same Claude subscription, different
  machines, **never working simultaneously**. GitHub is the single source of truth.
- Claude commits in-session (only intended files); the human pushes from their terminal.
  Claude never pushes.
- Recommendation-first always: brainstorm + recommend + wait for explicit "go ahead"
  before building. Small verified phases, one commit each.
- The `context/` folder (this) + repo-root `CLAUDE.md` are the shared brain, synced via
  GitHub. Update `STATE.md` + `CHANGELOG.md` before every push. (Per-device Claude
  "memory" folders do NOT sync — don't rely on them for shared context.)

## Data & safety
- No data loss, ever. Prefer additive / soft-delete. Flag any data risk; get a nod
  before any prod DB write or migration (Supabase `qtmkjxtjtpqeizvqiubu` is live, no staging).
- Soft-delete uses `is_deleted` + `deleted_at` on leads/demos/deals. Orgs use `is_banned`
  only (no is_deleted on organizations).

## Timezone
- Everything is IST (Asia/Kolkata). Use the helpers in `src/lib/utils.ts`. Never set
  Vercel `TZ`. Absolute timestamps (created_at/updated_at/deleted_at) stay UTC ISO.

## Banning organisations (request → admin confirms)
- `is_banned` is **admin-only** (enforced in `PATCH /api/organizations/[id]`). SDRs and
  Closers can only REQUEST a ban; only admin executes it.
- SDR path: the "Banned" outcome sets the lead to `phase='dead'`,
  `returned_reason='ban_requested'` → admin sees it in Lead Pool → Returned tab → "Ban
  Requests" → Confirm Ban.
- Closer path (mirror): Ban button in the Kanban DealPanel → `POST /api/deals/[id]/ban-request`
  → soft-deletes the deal+demo (EXPUNGE, chosen to match permanent-delete — removes them
  from deal/demo counts + SDR demo credit) and routes the lead to the same admin Ban
  Requests pool. Admin confirms.
- Every ban REQUEST (SDR or closer) notifies all admins.
- Banned orgs: hidden from all SDR/Closer working lists; red "Banned · Do Not Contact"
  in org search with all actions blocked.

## Notifications
- Bell dropdown in the TopBar (not a modal, not a sidebar). Latest 30, newest-first,
  grouped Today/Earlier; badge = unread count; read just clears the badge (doesn't delete).
- Notify only about OTHER people's actions the recipient must act on (never self-actions).
- `notifications` table: RLS so each user sees/updates only their own; inserts are
  service-role only (via `src/lib/notifications.ts`, best-effort — must never break the
  core action). Notifications are standalone rows (no FK to org/lead/deal) — deleting a
  record does NOT delete its notifications.
- Retention: auto-delete notifications older than 30 days (read AND unread), run from the
  daily cron. Delivery is 60s polling — deliberately NO Supabase Realtime/sockets (cheap
  at ~15 users).

## Integrations
- **UniSheet sync = one-way push only** (CRM → UniSheet). Nothing writes back into the
  CRM. Single-row upserts (UniSheet batch mode is buggy). Incremental via a per-lead
  dirty queue; sheet converges to the DB. Twice-daily cron. The webhook URL is the sheet's
  password → Vercel env only, never in code.
- **Email = Resend, not Instantly** (Instantly is for cold outreach; internal mail would
  pollute warmup/stats). App composes emails from SQL with deterministic templates (no
  AI) for accuracy. Recommended sending domain: subdomain `crm.daanveda.com`.

## Funnel / metrics nuances (agreed)
- Returned (phase='dead') leads STILL count as "assigned" in the funnel + leaderboard
  (they were genuinely assigned/worked); only truly `is_deleted` records are excluded.
- `demos.sdr_id` is immutable for attribution EXCEPT deliberate SDR-credit reassignment
  in the Closer "Upcoming Demos" reassign (credit-only; lead stays with closer).
