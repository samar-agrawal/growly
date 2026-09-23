# Growly

Growly is a lightweight learning tracker built around a weekly commitment model, optional buffer, and structured curriculum tracking.

## Stack

- Frontend: Next.js + Tailwind CSS
- Backend: Node.js + Express
- Local development: Docker Compose
- Persistence: SQLite planned for the next implementation phase

## Local development

From the project root:

```bash
docker compose up --build
```

Then open:

- Frontend: http://localhost:3000
- Backend health: http://localhost:4000/health

## Project structure

```text
.
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   └── server.js
├── frontend/
│   ├── app/
│   ├── Dockerfile
│   ├── next.config.mjs
│   ├── package.json
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   └── .eslintrc.json
├── docker-compose.yml
├── .env.example
├── .gitignore
├── PRD.md
├── plan.md
└── README.md
```

## API shape

The backend exposes the initial mock API contract:

- `GET /health`
- `GET /api/settings`
- `GET /api/dashboard`
- `GET /api/categories`
- `GET /api/topics`
- `GET /api/sessions`

## Notes

This scaffold is intentionally a mock-data foundation so the dashboard workflow, API contracts, and deployment path can be validated before adding SQLite-backed persistence and richer product features.
