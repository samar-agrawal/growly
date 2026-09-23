## Goal
Build a lightweight learning tracker centered on a weekly commitment model: X hours committed, X hours optional buffer, Sunday–Saturday tracking, and flexible learning that can include both unstructured sessions and optional curriculum tracking.

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

## 5) Phase 1 — Weekly commitment + optional buffer
- Build the primary dashboard and weekly summary for the required learning budget.
- Support a 7-hour commitment and a 2-hour optional buffer for Sunday–Saturday tracking.
- Allow users to log sessions manually and connect them to a category or topic when relevant.
- Report commitment completion and optional buffer usage separately to preserve the distinction between required and flexible time.
- Include a week rollover and summary states for partial completion, overage, and under-target weeks.
- This is the first deployable feature slice and should be validated before moving to the next phase.

## 6) Phase 2 — Category and curriculum tracking
- Add category creation, editing, and optional curriculum toggle support.
- Allow each topic to track status, session count, total hours, notes, and completion metadata.
- Support topic states of Not started, In progress, and Completed.
- Keep curriculum progress based on completed topics versus total topics.
- Display the percentage alongside an accomplishment count so new topics do not demotivate users when the denominator changes.

## 7) Phase 3 — Topic recency and activity overview
- Show when each topic was last covered based on all relevant session activity.
- Include both learning and revision activity in the topic recency model.
- Add a compact summary view that highlights active, stale, and recently reviewed topics.
- Keep the UI scannable and simple enough for regular use without deep analysis.

## 8) Phase 4 — Revision handling and timer workflow
- Add an optional timer flow for focused study or revision blocks.
- Ensure revision sessions are counted toward the same weekly budget rather than as hidden extra time.
- Support explicit confirmations before finalizing a timed session.
- Add a notification layer for reminders and study nudges, gated by user permission.
- Keep manual session entry available alongside timer-based logging.

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
