# Growly

Growly is a local weekly learning tracker. Organize learning into Focus Areas and subtopics, log sessions in 30-minute slots, and track a core weekly commitment with optional buffer and revision time. Data is stored in PostgreSQL (including a Supabase connection), configured through the required `DATABASE_URL`; fresh installations contain no seeded learning records or saved settings.

## Current features

- **Overview:** weekly commitment and buffer, optional revision progress, week start date/day, and days remaining including today. Shows the five most recently updated Focus Areas and up to five recent subtopics per area, plus six recent sessions.
- **Focus Areas:** view the full lists; create, edit, and delete areas and subtopics. Subtopics support `Not started`, `In Progress`, and `Completed` statuses, session totals, notes, and completion dates. Enable curriculum tracking per Focus Area to see its completed count and percentage.
- **Sessions:** log, view, edit, and delete sessions across all dates, with optional outcomes and notes. Select an existing Focus Area, leave the session unassigned, or enter a new name. Matching names are reused; a new area is created only when the session is saved.
- **Weekly chart:** compare hours per Focus Area and navigate between weeks. Revision and unassigned time are included.
- **Activity:** search subtopics, see session-derived hours and last-covered/reviewed dates, filter by recency, and start a review without changing completion status.
- **Settings:** weekly commitment, optional buffer, optional revision hours, and Monday/Sunday week start. Hours accept quarter-hour increments; sessions use whole 30-minute slots.

Optional timers support pause/resume, another 30-minute slot after completion, and reload recovery within the same tab. Timer completion requires review and explicit confirmation before anything is logged; repeated saves of a timed block are deduplicated. Manual entry remains available.

Opt into reminders in Settings and choose an interval. Browser alerts require an explicit permission grant and saved preference. Reminders run only while the page is open and pause during a focus block; no closed-browser push scheduling is implemented.

All deletions require confirmation in the UI. Deleting a Focus Area removes its subtopics but keeps past sessions as unassigned history; Revision sessions reviewing those subtopics retain their Revision area. Deleting a subtopic keeps its sessions under the parent area. Deleting a session removes its logged time from totals.

## Weekly budgets

Weekly boundaries use **UTC** and the selected week start. Until settings are saved, calculations use Monday without creating a settings record. The displayed days remaining include today. The open page refreshes data every minute and on return to the tab, including week rollover.

Non-revision sessions count toward the core commitment first, then the optional buffer. Sessions linked to an area named **Revision** (trimmed, case-insensitive) count toward a separate optional revision budget. They remain included in the chart and all-session totals. “Log revision” selects that area or offers to create it when saving the session; it is not pre-seeded. Combined commitment, buffer, and revision budgets cannot exceed 168 hours.

There is no timezone setting, session type, revision-slot setting, or global curriculum summary in the current UI. Curriculum progress is shown only within opted-in Focus Areas.

## Run locally

The stack is Next.js 16, React 19, Tailwind CSS 4 with custom CSS, Express 5, and PostgreSQL via `pg`. Use Node.js 22.9 or newer; the verified runtime is Node.js 25. Docker uses Node.js 25.

Dependencies were refreshed on 2026-09-25 against stable npm releases. ESLint and `@eslint/js` remain on 9.39.5 because the latest `eslint-plugin-react` (7.37.5, April 2025) supports ESLint 9 but not 10. Node type definitions stay on the latest 24.x release to match the local Node 24 runtime. Regenerate the backend lockfile with the Docker image’s npm: host npm 11.6.2 can omit the nested `picomatch` entry required by `npm ci` in Docker.

From the project root:

```bash
npm ci
npm ci --prefix backend
npm ci --prefix frontend
export DATABASE_URL='postgresql://growly:password@localhost:5432/growly'
npm run dev --prefix backend
```

In a second terminal:

```bash
npm run dev --prefix frontend
```

Open [Growly](http://localhost:3000). The backend health endpoint is [http://localhost:4000/health](http://localhost:4000/health).

Alternatively:

```bash
docker compose up --build
```

Compose runs development servers. Set `DATABASE_URL` in the root `.env` to an existing PostgreSQL server reachable from the backend container. Compose does not start a database.

## Configuration

| Variable                        | Consumer        | Behavior                                                                                                                             |
| ------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `INTERNAL_API_URL`              | Frontend server | Backend address for the same-origin `/api` gateway; defaults to `http://localhost:4000`, set to `http://backend:4000` in Compose.    |
| `DATABASE_URL`                  | Backend         | Required PostgreSQL connection string; startup fails when missing. Use a server-side Supabase PostgreSQL connection, not an API key. |
| `BACKEND_PORT`, `FRONTEND_PORT` | Compose         | Published development ports, defaults `4000`/`3000`; production publishes only the frontend.                                         |
| `PORT`                          | Backend         | Listening port; defaults to `4000`.                                                                                                  |

Set backend variables in the shell or Compose environment. For Next.js, use the shell or `frontend/.env.local` for `INTERNAL_API_URL`. Browser requests always use the same-origin `/api` gateway. Copy `.env.example` to `.env` for Compose configuration. npm scripts do not load the root `.env`; export backend variables and use `frontend/.env.local` for the frontend.

## Persistence

Startup creates missing PostgreSQL tables and indexes from `backend/schema.sql`, with no seeded data. The unused `archived_at` column is dropped if present. Current tables are `settings`, `focus_areas`, `subtopics`, and `sessions`. API validation and transactional writes maintain relationships and preserve session history; direct SQL writes must maintain relationships themselves.

SQLite support and historical migrations have been removed. Existing SQLite files are left untouched and are not imported. Use PostgreSQL/provider backups for persistence.

## Production containers and PostgreSQL

```bash
docker compose -f docker-compose.production.yml up --build -d
npm run smoke
```

Production uses standalone Next.js, a separate API container, non-root processes, health checks, and an external PostgreSQL database. Only the frontend is published, on `127.0.0.1:3000` by default. The browser calls the frontend gateway, so internal container addresses stay server-side. Override `FRONTEND_PORT` as needed and set `SMOKE_URL` to test another address.

Set `DATABASE_URL` in the root `.env` for Compose, or export it for a local backend. Use a server-side PostgreSQL/Supabase connection string and configure TLS as required by your provider.

Growly serves one shared dataset and has no login. Keep it private or put authenticated access in front of it before exposing it publicly.

## API

| Method      | Route                  | Purpose                                |
| ----------- | ---------------------- | -------------------------------------- |
| GET         | `/health`              | Backend health                         |
| GET, PUT    | `/api/settings`        | Read/save weekly settings              |
| GET         | `/api/dashboard`       | Current UTC week and calculated totals |
| GET, POST   | `/api/focus_areas`     | List/create Focus Areas                |
| PUT, DELETE | `/api/focus_areas/:id` | Edit/delete a Focus Area               |
| GET, POST   | `/api/subtopics`       | List/create subtopics                  |
| PUT, DELETE | `/api/subtopics/:id`   | Edit/delete a subtopic                 |
| GET, POST   | `/api/sessions`        | List/create sessions                   |
| PUT, DELETE | `/api/sessions/:id`    | Edit/delete a session                  |

Identifiers are `id_focus_area`, `id_subtopic`, and `id_session` in both stored records and API responses. See the [backend knowledge base](backend/knowledge_base.md) for request payloads and calculation rules.

## Checks and project guide

```bash
export TEST_DATABASE_URL='postgresql://growly:password@localhost:5432/growly_test'
npm run check          # lint, backend/frontend tests, production build
npm run format:check
npm run smoke          # read-only checks against the running frontend/gateway
# Browser suite; install Chromium once in an environment where downloads are allowed:
npx playwright install chromium
npm run test:e2e
```

Backend and browser tests require `TEST_DATABASE_URL`, pointing to a test database with permission to create/drop schemas. Each run uses an isolated temporary schema and removes it afterward. Backend coverage includes PostgreSQL CRUD, restart persistence, validation, concurrent saves, revision accounting, activity, and UTC week boundaries. Frontend unit tests cover activity and timer behavior. Playwright covers desktop/mobile flows and requires Chromium.

| Location                                                 | Role                                        |
| -------------------------------------------------------- | ------------------------------------------- |
| [frontend/app/page.js](frontend/app/page.js)             | Active Next.js interface and forms          |
| [frontend/app/globals.css](frontend/app/globals.css)     | Responsive styles                           |
| [frontend/lib/api.js](frontend/lib/api.js)               | API client                                  |
| [frontend/knowledge_base.md](frontend/knowledge_base.md) | Frontend behavior and implementation guide  |
| [backend/server.js](backend/server.js)                   | API, validation, persistence, and summaries |
| [backend/schema.sql](backend/schema.sql)                 | PostgreSQL tables and indexes               |
| [backend/database.js](backend/database.js)               | PostgreSQL connection and transactions      |
| [backend/week.js](backend/week.js)                       | UTC week boundaries                         |
| [backend/knowledge_base.md](backend/knowledge_base.md)   | Backend contracts and maintenance guide     |
| [docs/](docs/)                                           | Visual references                           |

`plan.md` records current delivery status and deferred scope. `PRD.md` retains original examples and terminology; current user decisions and this README take precedence.
