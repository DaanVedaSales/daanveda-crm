---
name: daanveda-crm
description: Working protocol for the DaanVeda CRM repo. Use at the START of every session (sync from GitHub, read the shared context, report what changed) and BEFORE every push (update the shared context). Enforces recommendation-first, no data/functionality loss, and only-aligned-changes. Trigger whenever working in this repo.
---

# DaanVeda CRM — working protocol

Live production CRM with two contributors (owner + assistant) who never work at the same
time. GitHub is the single source of truth that keeps both machines in sync.

## 1. Sync first — start of EVERY session
- `git pull origin main`.
- Read `context/STATE.md`, `context/DECISIONS.md`, `context/CHANGELOG.md`, and the
  repo-root `CLAUDE.md`. This is the full history + current status; treat it as authoritative.
- Run `git log --oneline -15`; identify commits since the user last worked and summarize
  for them, in plain words, what changed and who changed it. THEN continue.

## 2. Recommendation-first — before building anything
- Analyze end-to-end against the real code + live Supabase data (ref `qtmkjxtjtpqeizvqiubu`).
- Give: root cause / plan / dependencies / risks / scale + dashboard-metrics impact.
- Ask clarifying questions. WAIT for an explicit "go ahead" before writing any code.

## 3. Build safely
- Strict scope: only the agreed change + its true dependencies. Touch nothing unrelated;
  don't "improve" things not asked for. Preserve all existing functionality — nothing lost.
- No data loss: additive / soft-delete. Flag any data risk and get an explicit nod before
  ANY prod DB write or migration (production, no staging).
- Think end-to-end: UI, API, DB, RLS/policies, cross-workspace effects. Audit
  dashboard/metrics impact on every lead-lifecycle change.
- Verify: `NODE_OPTIONS=--max-old-space-size=6144 npx tsc --noEmit`. The repo has
  pervasive pre-existing untyped-client noise (TS2339/2345/2769 "on type never") — add NO
  new error classes vs HEAD; prove it by per-file count comparison (git stash → count → pop).
- IST everywhere via `src/lib/utils.ts` helpers; never set Vercel `TZ`.

## 4. Update the shared brain — BEFORE every push
- Update `context/STATE.md` (current status + pending) and append `context/CHANGELOG.md`
  (what changed, why, files, who, commit, any migration). Commit the docs WITH the code.
- Commit only the intended files (never `git add -A`). Commit messages end with:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Claude commits; the HUMAN runs `git push origin main` from their terminal. Claude never pushes.

## First-run (new machine) checklist
- Confirm the Supabase tool reaches ref `qtmkjxtjtpqeizvqiubu` and the Vercel project is visible.
- Git/GitHub over SSH: ensure `~/.ssh/id_ed25519.pub` exists (else `ssh-keygen -t ed25519`),
  the key is added to the user's GitHub account, and the account is a collaborator on
  `DaanVedaSales/daanveda-crm`. Test `ssh -T git@github.com`, then
  `git clone git@github.com:DaanVedaSales/daanveda-crm.git`.
