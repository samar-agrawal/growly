# Growly

Growly helps you track learning progress, see how your attention is spread across different areas, and know when you’ve done enough for the week. Your browser may have 47 learning tabs open. Your brain deserves a closing time.

It started with a simple need: make progress visible without getting overwhelmed by everything there is to learn. Set a manageable weekly commitment, choose what matters, and give yourself a clear point to stop. Extra time is optional. The sofa is also a valid next step.

## What you can do

- **See your progress:** the Overview shows your weekly commitment, logged time, and optional buffer. Compare hours across Focus Areas and previous weeks.
- **Organize your learning:** group subtopics into Focus Areas, keep notes, and optionally track curriculum completion.
- **Record your effort:** log sessions in 30-minute slots, with optional outcomes and notes. Use a focus timer or enter sessions manually.
- **Keep things fresh:** see when you last studied or reviewed a topic, and make room for optional revision.
- **Connect effort to outcomes:** use the separate Growth Objectives tab to define what you want to develop, why it matters, and what success looks like.

Timers support pause, resume, and recovery after a reload in the same tab. Completed timers need your confirmation before logging a session. Optional reminders work while the page is open.

## Small steps. Sensible stopping points.

Your weekly commitment is the amount of learning you want to make room for. Once you meet it, you can stop. Yes, even if someone on the internet learned three programming languages before breakfast. The buffer is there if you want extra time; it is optional. Revision has its own optional budget, using sessions in a Focus Area named **Revision**. Weeks follow UTC, starting on Monday or Sunday.

Growth Objectives keeps the list small: up to **three unfinished objectives**. A little focus helps; a second, more ambitious to-do list probably doesn’t. Each has a motivation, priority, status, target date, and success criteria. Link Focus Areas, subtopics, or individual sessions to see accumulated learning hours and the last activity date. Linked areas and topics include past and future sessions; a session can support multiple objectives while counting only once toward your weekly budget.

You decide when an objective is achieved, independently of curriculum completion. No need to finish the entire internet first. Archive it to set it aside, or achieve or delete it to make room for another; archived objectives still count toward the limit. You can disable Growth Objectives in its tab at any time. Your objectives are preserved, and the learning tracker keeps working. No guilt trip included.

## Get started

Growly uses Next.js, React, Express, and PostgreSQL. You need an existing PostgreSQL database; a Supabase PostgreSQL connection also works. New installations start empty, and database tables are created on startup.

### With Docker

Copy `.env.example` to `.env` and set `DATABASE_URL` to a PostgreSQL connection string reachable from the containers. Compose does not start a database.

```bash
docker compose up --build
```

Open [Growly](http://localhost:3000). After changing source files, rebuild the affected container to pick up the changes.

### Without Docker

Use Node.js 25 to match the Docker runtime. From the project root:

```bash
npm ci
npm ci --prefix backend
npm ci --prefix frontend
export DATABASE_URL='postgresql://growly:password@localhost:5432/growly'
npm run dev --prefix backend
```

In another terminal:

```bash
npm run dev --prefix frontend
```

Open [Growly](http://localhost:3000). Local npm commands do not load the root `.env`; export backend variables in your shell.

## Configuration and deployment

| Variable                        | Purpose                                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`                  | Required server-side PostgreSQL connection string.                                               |
| `INTERNAL_API_URL`              | Frontend-to-backend address; defaults to `http://localhost:4000`. Compose sets it automatically. |
| `FRONTEND_PORT`, `BACKEND_PORT` | Development Compose ports; defaults are `3000` and `4000`.                                       |
| `PORT`                          | Backend port outside Compose; defaults to `4000`.                                                |

For local frontend configuration, set `INTERNAL_API_URL` in the shell or `frontend/.env.local`. Configure database TLS as required by your provider, and use PostgreSQL/provider backups for your data.

For production:

```bash
docker compose -f docker-compose.production.yml up --build -d
npm run smoke
```

Production exposes only the frontend at `127.0.0.1:3000` by default. Set `FRONTEND_PORT` to change the port and `SMOKE_URL` to check another address. Growly uses one shared dataset and has no login, so keep it private or place authenticated access in front of it.

## Development

```bash
export TEST_DATABASE_URL='postgresql://growly:password@localhost:5432/growly_test'
npm run check          # Lint, backend/frontend tests, production build
npm run format:check
npx playwright install chromium
npm run test:e2e       # Desktop and mobile browser checks
```

Backend and browser tests need a test database with permission to create and drop schemas. Each run uses an isolated temporary schema.

The UI lives in [frontend/app/page.js](frontend/app/page.js) and [frontend/components](frontend/components). The API and persistence code live in [backend](backend), with the schema in [backend/schema.sql](backend/schema.sql).

See the [frontend guide](frontend/knowledge_base.md) and [backend guide](backend/knowledge_base.md) for implementation details. The objectives API supports `GET/POST /api/objectives`, `PUT/DELETE /api/objectives/:id`, and `PUT /api/objectives/preferences` to enable or disable the module. [PRD.md](PRD.md) and [prd2.md](prd2.md) describe the original tracker and Growth Objectives requirements.
