## Goal
Build a lightweight learning tracker centered on a weekly commitment model: X hours committed, X hours optional buffer, Sunday–Saturday tracking, and flexible learning that can include both unstructured sessions and optional curriculum tracking.

## Current decisions that supersede early wording
- User-created data only: no seeded learning records or automatic saved settings.
- Current names are Focus Areas and subtopics; explicit `id_*` identifiers are used without foreign-key constraints.
- Weeks use UTC with a Monday/Sunday setting. Revision has separate optional hours but remains included in overall weekly totals.
- Phase 2 and Phase 4 below refer to the labeled product phases (sections 6 and 8), not scaffold/data-model sections 2 and 4.

## Clarified assumptions
- Single-repo app with a frontend and a backend API, using Docker for local development.
- Default MVP scope focuses on weekly commitment and buffer tracking first; other PRD features ship later as independent phases.
- Local persistence is SQLite; the mock API layer is used first to validate interaction and data contracts.
- The product is a web app and the preferred frontend direction is a Next.js-friendly React app, with a lightweight backend service for data and business logic.

## 1) Lo-fi UX and interaction design
- Map the primary flows for the dashboard, category list, topic detail, and session log before coding.
- Use wireframes or lo-fi mockups to define the weekly summary, weekly progress header, buffer usage, and category/topic cards.
- Verify the visual distinction between committed time and optional time so the buffer never becomes the new baseline.
- Validate the product language around commitment hours, optional buffer, curriculum tracking, revision, and activity recency.
- Add support for adding data, topic / category, curriculum.
- Keep the first pass visually simple and static so the team can validate the workflow before backend integration.

## 2) Frontend and backend scaffold with Docker and readme
- Create the project shell with a frontend app and a backend API, along with a Docker Compose setup for local development.
- Add base config for environment variables, shared services, dependency management, and health checks.
- Keep the initial app structure intentionally lean: dashboard, categories, topics, sessions, and summary views.
- Include the local database service and ensure the app can run with one command in a fresh environment.
- Expect the scaffold to evolve from mock state to SQLite-backed state without a full frontend rewrite.
- For local dev the app will use sqlite, for production it will use postgresql supabase

## 3) UI implementation with mock APIs
- Define the initial API contracts for settings, summary, categories, topics, and sessions.
- Implement mock endpoints with seeded example data that reflect a realistic study week and category configuration.
- Validate empty, partial, and complete states for the dashboard, category list, curriculum views, and session history.
- Make the frontend consume the same data shape it will eventually get from the real backend.
- Keep navigation and interaction patterns stable so the switch from mock data to production data is low-risk.

## 4) SQLite data model for local development
- Create a schema for settings, categories, topics, and learning sessions.
- Store the weekly commitment, buffer, week start date, and other app config as persistent configuration.
- Keep category and topic records normalized so sessions can link back to the correct area without duplication.
- Derive topic totals, recency, and curriculum completion from session history instead of storing stale copies.
- Reserve space for revision, notification, and future analytics fields without overcomplicating the first schema.
- Status: implemented in the backend as a local SQLite database with user-created data and API routes backed by persistent tables.

## 5) Phase 1 — Weekly commitment + optional buffer
- Build the primary dashboard and weekly summary for the required learning budget.
- Support a 7-hour commitment and a 2-hour optional buffer for Sunday–Saturday tracking.
- Allow users to log sessions manually and connect them to a category or topic when relevant.
- Report commitment completion and optional buffer usage separately to preserve the distinction between required and flexible time.
- Include a week rollover and summary states for partial completion, overage, and under-target weeks.
- This is the first deployable feature slice and should be validated before moving to the next phase.

## 6) Phase 2 — Focus Area and curriculum tracking
- Status: implemented. Focus Areas replace the earlier category terminology; their children are subtopics.
- Create and edit Focus Areas with an optional curriculum tracking checkbox; the choice is persisted.
- Subtopics expose status, all-time session count/hours, notes, and completion date.
- Supported states: Not started, In Progress, and Completed. Completing a subtopic sets its completion date; reopening it clears the date.
- Opted-in Focus Area cards show completed/total counts alongside the percentage, based on all children (including those hidden by overview limits).
- Adding a subtopic changes the denominator without resetting prior completions. Turning curriculum tracking off does not erase accomplishments.
- The previously removed global Current curriculum block stays removed; curriculum reporting is per Focus Area.

## 7) Phase 3 — Topic recency and activity overview
- Show when each topic was last covered based on all relevant session activity.
- Include both learning and revision activity in the topic recency model.
- Add a compact summary view that highlights active, stale, and recently reviewed topics.
- Keep the UI scannable and simple enough for regular use without deep analysis.

## 8) Phase 4 — Revision handling and timer workflow
- Status: implemented with the current revision-budget and UTC decisions below.
- Session logging offers manual Save session and optional Start timer actions, using 30-minute slots for learning or Revision. Timers support 1–48 slots, pause/resume, and explicit discard confirmation.
- Timer deadlines use wall time to tolerate delayed background ticks. Timer drafts survive reload within the same tab using sessionStorage; they are not saved sessions.
- Completion does not write to the API. Review and confirm the completed block to finalize it; cancel keeps the completed block available. Repeated saves of the same timer reference return the already saved session.
- Revision is a Focus Area with its own optional weekly hours allowance, as subsequently requested. It is included in the same overall weekly time total and chart, while core commitment/buffer progress excludes it. No session_type or revision_slots fields are restored.
- Opt-in reminders have a user-chosen interval (15–1440 minutes) and pause while a timer exists. In-app notices work without browser permission. Browser notification permission is requested only by clicking Allow browser notifications; saved preferences control subsequent alerts.
- Reminders require the page to remain open; this phase does not implement service-worker push or closed-browser scheduling. A running timer can recover after reload, but closing the tab ends that tab's timer draft.
- Validation: backend regression tests, frontend timer unit tests, and the production build. Interactive browser verification remains outstanding because the browser download was declined.

## 9) Phase 5 — Product polish and operational readiness
- Add editing and deletion flows for categories, topics, and sessions.
- Improve empty states, validation, accessibility, and mobile clarity.
- Add tests, linting, and basic deployment checks for the Dockerized environment.
- Review summary calculations, status transitions, and week boundaries before broader release.
- Treat future enhancements like curriculum versioning or richer analytics as a follow-up after the MVP is stable.

## Verification
1. Validate the lo-fi mockups against the PRD’s core flows: weekly commitment, buffer reporting, category tracking, and topic completion.
2. Confirm the Dockerized scaffold starts locally without manual fixes and exposes the expected frontend and backend entry points.
3. Verify the mock API layer matches the real data contract used in the UI before SQLite is connected.
4. Run end-to-end checks for a sample week that includes partial progress, buffer usage, and a curriculum-enabled category.
5. Confirm that topic totals, completion status, and weekly summaries remain consistent after session edits and new entries.
6. Validate the MVP release criteria before moving to timer, revision, and deeper analytics features.

## Scope boundaries
- Included in the initial delivery: weekly budget, session logging, category/topic tracking, and core curriculum reporting.
- Deferred: deeper analytics, advanced revision automation, curriculum versioning, and larger product polish.
- Out of scope for v1: complex syncing, multi-user support, or enterprise-scale data features.

## Relevant files
- [PRD.md](PRD.md) — product requirements and MVP direction.
- docs/ — design references and example UI imagery.
