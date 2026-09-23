# Growly

Growly is a weekly learning tracker built around a weekly commitment model, optional buffer, and structured curriculum tracking.

## Stack

- Frontend: Next.js + Tailwind CSS
- Backend: Node.js + Express
- Persistence: SQLite, stored locally in the backend `data` directory
- Local development: Docker Compose

## Core workflow

The app supports:
- changing weekly commitment and buffer settings
- creating categories and topics
- logging study and revision sessions
- updating the dashboard totals based on the stored data

The dashboard is driven by the database, not static mock arrays.

## Local development

From the project root:

```bash
npm install --prefix backend
npm install --prefix frontend
npm run dev --prefix frontend
```

Or, with Docker:

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
│   ├── data/
│   ├── Dockerfile
│   ├── package.json
│   ├── schema.sql
│   ├── server.js
│   └── knowledge_base.md
├── frontend/
│   ├── app/
│   ├── Dockerfile
│   ├── lib/
│   ├── package.json
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   └── knowledge_base.md
├── docker-compose.yml
├── .env.example
├── .gitignore
├── PRD.md
├── plan.md
├── README.md
└── docs/
```

## API shape

The backend exposes a real local data contract:

- `GET /health`
- `GET /api/settings`
- `PUT /api/settings`
- `GET /api/dashboard`
- `GET /api/categories`
- `POST /api/categories`
- `GET /api/topics`
- `POST /api/topics`
- `GET /api/sessions`
- `POST /api/sessions`

## Notes

This implementation keeps the app simple but real: settings and session data are persisted in SQLite, and the dashboard updates from the database immediately after changes are saved.
