# context/ — the shared brain

This folder is the GitHub-synced source of truth for anyone (human or Claude) working on
the DaanVeda CRM across any machine. Per-device Claude "memory" folders do NOT sync — this
does.

- **STATE.md** — what the project is, infra, current status, conventions, what's shipped,
  what's parked/pending, how we work. Read first; update before every push.
- **DECISIONS.md** — durable product/technical decisions already locked in.
- **CHANGELOG.md** — chronological log of shipped work (append before every push).

Also read the repo-root **`CLAUDE.md`** for the technical reference (schema, API routes,
design system, business rules).

The working protocol is enforced by the **`daanveda-crm` skill** (`.claude/skills/daanveda-crm/`):
pull-first, recommendation-first, update-context-before-push, no data/functionality loss.
