# Growly delivery plan

## Current decisions

- User-created Focus Areas, subtopics, sessions, and settings only; no seeded budgets or learning data.
- Sessions use 30-minute slots. Week boundaries use UTC and a saved Monday/Sunday start; no timezone setting.
- Core commitment, optional buffer, and optional Revision hours are separate. Revision is an ordinary user-created Focus Area; no session type or revision-slot column.
- Explicit IDs (`id_focus_area`, `id_subtopic`, `id_session`, `id_setting`); no foreign-key constraints. Transactional API writes maintain relationships.
- PostgreSQL only, using a required `DATABASE_URL`; same-origin browser API access only.
- Next.js/React frontend, Express backend, development and production Docker configurations.

These decisions supersede the original PRD's example budgets, category/topic terminology, and revision accounting.

## Phase 1 — Weekly commitment and optional buffer: implemented

- Saved editable budgets and week start, separate optional revision budget.
- Weekly totals, commitment/buffer/revision progress, remaining days including today.
- Manual session logging, free-text Focus Area creation, full session history, weekly chart with week navigation.
- Minute-based refresh while visible and refresh on return to the tab handle week rollover.

## Phase 2 — Focus Areas and optional curriculum: implemented

- Focus Area/subtopic create, edit, and confirmed deletion.
- Optional per-area curriculum percentage and completed count, shown only when children exist.
- Explicit subtopic statuses, completion dates, notes, session counts, accumulated hours.
- Overview limits to five recent areas and five recent children; searchable full library.
- Sessions do not automatically change completion status.

## Activity and recency: implemented

- Session-derived last-covered and last-reviewed dates, including reviews of completed subtopics.
- Activity view with search, oldest-first ordering, and recent/quiet/ready-for-review/never-studied filters.
- Review shortcut allows Revision sessions to reference subtopics from another Focus Area while preserving ownership and completion state.

## Phase 4 — Revision and timer workflow: implemented

- Optional timer, pause/resume, background-safe deadlines, same-tab reload recovery.
- Continue a completed block for another 30-minute slot, up to 48 slots.
- Review and explicit confirmation before saving; idempotent timer submissions.
- Opt-in in-page reminders and browser notifications with explicit permission; manual entry stays available.

## Phase 5 — Polish and operational readiness: implemented, verification limits below

- Empty states, gentle humour, library search, mobile layouts, clear confirmation copy.
- Form labels/hints, focus restoration, skip link, table semantics, larger touch controls.
- Name/text/date/slot validation, malformed JSON handling, request timeouts, noncached API responses.
- Same-origin frontend gateway, database-aware backend health, frontend health, graceful backend shutdown.
- PostgreSQL transactions and schema initialization; no historical migration or startup reset.
- Separate development/production images, non-root production processes, standalone Next.js, external PostgreSQL persistence, health checks.
- Root lint/format/test/build/smoke scripts and isolated desktop/mobile Playwright tests.
- README and frontend/backend knowledge bases updated.

## Release verification

Run `npm run check` with `TEST_DATABASE_URL` set. Integration tests use isolated PostgreSQL schemas. Browser tests additionally require Chromium; production container and live Supabase verification remain separate deployment checks.

## Deferred scope

Advanced revision questions/recall scoring, curriculum versioning, richer analytics, closed-browser push scheduling, multi-user accounts, and syncing remain outside this release. The app serves one shared dataset; public deployment requires an access-control layer.

## References

- [README.md](README.md): setup, configuration, persistence, checks.
- [backend/knowledge_base.md](backend/knowledge_base.md): API and data rules.
- [frontend/knowledge_base.md](frontend/knowledge_base.md): UI and state behavior.
- [PRD.md](PRD.md): original product direction; current decisions above take precedence.
- [docs/](docs/): visual references.
