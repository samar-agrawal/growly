# Growly

Growly is a local weekly learning tracker. Organize learning into Focus Areas and subtopics, log sessions in 30-minute slots, and track a core weekly commitment with optional buffer and revision time. User data is stored in SQLite; fresh installations contain no seeded learning records or saved settings.

## Current features

- **Overview:** weekly commitment and buffer, optional revision progress, week start date/day, and days remaining including today. Shows the five most recently updated Focus Areas and up to five recent subtopics per area, plus six recent sessions.
- **Focus Areas:** view the full lists; create, edit, and delete areas and subtopics. Subtopics support `Not started`, `In Progress`, and `Completed` statuses.
- **Sessions:** log, view, edit, and delete sessions across all dates, with optional outcomes and notes. Select an existing Focus Area, leave the session unassigned, or enter a new name. Matching names are reused; a new area is created only when the session is saved.
- **Weekly chart:** compare hours per Focus Area and navigate between weeks. Revision and unassigned time are included.
- **Settings:** weekly commitment, optional buffer, optional revision hours, and Monday/Sunday week start. Hours accept quarter-hour increments; sessions use whole 30-minute slots.

All deletions require confirmation in the UI. Deleting a Focus Area removes its subtopics but keeps past sessions as unassigned history. Deleting a subtopic keeps its sessions under the parent area. Deleting a session removes its logged time from totals.

## Weekly budgets

Weekly boundaries use **UTC** and the selected week start. Until settings are saved, calculations use Monday without creating a settings record. The displayed days remaining include today.

Non-revision sessions count toward the core commitment first, then the optional buffer. Sessions linked to an area named **Revision** (trimmed, case-insensitive) count toward a separate optional revision budget. They remain included in the chart and all-session totals. “Log revision” selects that area or offers to create it when saving the session; it is not pre-seeded. Combined commitment, buffer, and revision budgets cannot exceed 168 hours.

There is no timezone setting, session type, revision-slot setting, or curriculum summary in the current UI.

## Run locally

The stack is Next.js 16, React 19, Tailwind CSS 4 with custom CSS, Express, and SQLite via `sqlite3`. Docker uses Node.js 25.

From the project root:

```bash
npm install --prefix backend
npm install --prefix frontend
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

Compose runs development servers and persists SQLite in the `growly-data` named volume. That volume is separate from the host's `backend/data` directory.

## Configuration

| Variable | Consumer | Behavior |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | Frontend | Browser-accessible API address; defaults to `http://localhost:4000`. |
| `PORT` | Backend | Listening port; defaults to `4000`. |
| `CORS_ORIGIN` | Backend | Allowed frontend origin; Compose sets `http://localhost:3000`. When unset, the backend reflects the requesting origin. |
| `GROWLY_DATA_DIR` | Backend/migration | Database directory; defaults to `backend/data`. |
| `GROWLY_RESET_DB` | Backend | Only the literal value `true` clears all records on startup. Leave unset for normal use. |

Set backend variables in the shell or Compose environment. For Next.js, use the shell or `frontend/.env.local`; rebuild production bundles after changing `NEXT_PUBLIC_API_URL`. The root `.env.example` is a reference: its `BACKEND_PORT` and `FRONTEND_PORT` names are not wired into the scripts or Compose port mappings.

## Persistence and migrations

The local database is `backend/data/growly.db`. Current tables are `settings`, `focus_areas`, `subtopics`, and `sessions`, with explicit identifiers such as `id_session`. There are no database foreign-key constraints; API validation and SQL triggers maintain relationships and preserve session history.

Startup automatically migrates supported older schemas. To migrate without starting a server:

```bash
npm run migrate --prefix backend
```

Before rebuilding an existing schema, migrations create a SQLite snapshot next to the database:

- `growly.db.before-focus-areas-<timestamp>.bak` for the old categories/topics schema.
- `growly.db.before-remove-timezone-<timestamp>.bak` for the later timezone removal.

IDs, links, notes, timestamps, durations, and retained settings are preserved. Old session-type values stay in the backup; migration does not reassign historical sessions to Revision. Stop an older backend before manually migrating and restart the frontend/backend together when upgrading API names.

## API

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/health` | Backend health |
| GET, PUT | `/api/settings` | Read/save weekly settings |
| GET | `/api/dashboard` | Current UTC week and calculated totals |
| GET, POST | `/api/focus_areas` | List/create Focus Areas |
| PUT, DELETE | `/api/focus_areas/:id` | Edit/delete a Focus Area |
| GET, POST | `/api/subtopics` | List/create subtopics |
| PUT, DELETE | `/api/subtopics/:id` | Edit/delete a subtopic |
| GET, POST | `/api/sessions` | List/create sessions |
| PUT, DELETE | `/api/sessions/:id` | Edit/delete a session |

Identifiers are `id_focus_area`, `id_subtopic`, and `id_session` in both stored records and API responses. See the [backend knowledge base](backend/knowledge_base.md) for request payloads and calculation rules.

## Checks and project guide

```bash
npm test --prefix backend
npm run build --prefix frontend
```

Backend tests cover migration preservation and backups, persistence and CRUD, inline Focus Area creation, recency, revision accounting, and UTC week boundaries. The frontend has a production-build check but no configured browser-test suite.

| Location | Role |
| --- | --- |
| [frontend/app/page.js](frontend/app/page.js) | Active Next.js interface and forms |
| [frontend/app/globals.css](frontend/app/globals.css) | Responsive styles |
| [frontend/lib/api.js](frontend/lib/api.js) | API client |
| [frontend/knowledge_base.md](frontend/knowledge_base.md) | Frontend behavior and implementation guide |
| [backend/server.js](backend/server.js) | API, validation, persistence, and summaries |
| [backend/schema.sql](backend/schema.sql) | Tables, indexes, and history triggers |
| [backend/migrate.js](backend/migrate.js) | Automatic and standalone migrations |
| [backend/week.js](backend/week.js) | UTC week boundaries |
| [backend/knowledge_base.md](backend/knowledge_base.md) | Backend contracts and maintenance guide |
| [docs/](docs/) | Visual references |

`frontend/src`, `frontend/index.html`, and the Vite configuration are legacy scaffolding; current npm scripts run the Next.js app. `PRD.md` and `plan.md` describe earlier planning and may include features or terminology beyond the current implementation.
