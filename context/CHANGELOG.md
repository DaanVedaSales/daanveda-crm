# DaanVeda CRM — Changelog

Chronological log of shipped work (newest first). Append an entry BEFORE every push:
what changed, why, which files/areas, who drove it, commit hash, and any DB migration.
Older history predating this file lives in `git log` and the repo-root `CLAUDE.md`.

---

## 2026-07-22 — Context folder + collaboration skill (Prajwal)
Added `context/` (STATE / DECISIONS / CHANGELOG) as the GitHub-synced shared brain for
multi-machine collaboration, and `.claude/skills/daanveda-crm/SKILL.md` enforcing the
pull-first / recommendation-first / update-context-before-push routine. Docs only.

## 2026-07-22 — Notification 30-day auto-cleanup — commit `4b65c94` (Prajwal)
`src/lib/maintenance.ts` `cleanupOldNotifications()` deletes notifications older than 30
days (read AND unread; best-effort, never throws). Triggered from the existing daily
`/api/cron/sheet-sync` cron (GET+POST, before runSync) instead of a new vercel.json cron
entry — the CRM Vercel is likely Hobby/free (cron cap ≈2, both already used). Reusable
home for future daily jobs. No schema change.
- One-time prod cleanup done same day: deleted the 2 stale "TESTING" org notifications by
  id (only those; all other tables verified intact).

## 2026-07-18..22 — Closer ban-request + admin ban notification — commit `81037de` (Prajwal)
Ban button in the Kanban DealPanel (next to delete). `POST /api/deals/[id]/ban-request`
(owning closer + admin): soft-deletes deal+demo, routes lead to admin Ban Requests pool
(phase=dead, returned_reason=ban_requested), logs activity, notifies admins. `is_banned`
stays admin-only; admin confirms via existing Returned-tab flow. Also added
notifyRole(admin) to the SDR "Banned" outcome in `/api/activities`. New notification type
`ban_requested`. No schema change. Files: new deals/[id]/ban-request route, activities
route, closer/pipeline DealPanel, NotificationBell.

## 2026-07-17..22 — In-app notifications (P3a) — commit `17201ab` (Prajwal)
`notifications` table (migration `notifications_table`; RLS select/update own, inserts
service-role only). `src/lib/notifications.ts` best-effort helper. GET `/api/notifications`
(+unread count) and POST `/api/notifications/read`. `NotificationBell` replaces the
decorative TopBar bell (badge, Today/Earlier groups, mark-all-read, deep-link, 60s poll).
8 cross-workspace events wired (demo booked / no-show / reschedule / closer-reassign /
lead-returned / admin-assign / claim-decision / deal-won). Additive; no existing logic
touched.

## 2026-07-17 — UniSheet sync (BUILT, then parked) — commit `6813628` (Prajwal)
One-way push of a unified 44-column per-lead journey row to DaanVeda's UniSheet product.
`/api/cron/sheet-sync` (CRON_SECRET-gated, twice daily) drives a per-lead dirty queue.
DB migration `unisheet_sync_infra` + `unisheet_sync_row_v2`: moddatetime triggers on 6
tables, `sheet_sync_state`/`sheet_sync_rows`, and row-builder functions. `vercel.json`
crons at 09:30 + 18:30 IST. PARKED: `UNISHEET_WEBHOOK_URL` removed from Vercel pending a
UniSheet-side webhook bug fix; ~2,958 leads queued to backfill on re-enable.

## Earlier (pre-changelog — see git log + CLAUDE.md)
Org-search ghost-bug fix (deleted→hidden, returned→"With admin"); admin funnel is_deleted
correction; Laxmi My Leads scale fix (safety-net + server-side enrichment + indexes); SDR
KDM/follow-up batch ("Next Follow-up" rename, shared KdmEditor, contacts ownership check);
Closer feedback batch (proposal prompt, comment delete, choice-based deal delete + pop-back
fix, reassignment fixes); commission + funnel model + source_type; banned-orgs infra;
admin feature batch (dataset/bulk delete, enrich-&-assign, per-person/per-dataset analytics);
IST-correctness pass; data-integrity fixes (1000-row cap, upload enrich, assigned-status).
