# tripl

Analytics tracking plan service. Create projects, define configurable event types with fields and relations, maintain an event catalog, and track implementation metadata.

## Stack

- **Backend**: Python 3.13 · FastAPI · SQLAlchemy (async) · Alembic · PostgreSQL
- **Frontend**: React 19 · TypeScript · Vite · Tailwind CSS · TanStack React Query
- **Infrastructure**: Docker Compose

## Quick Start

```bash
cp .env.example .env
docker compose up -d --build
```

- **Frontend** → http://localhost:5173
- **API** → http://localhost:8000
- **API docs** → http://localhost:8000/docs

## Development

### Backend

```bash
cd backend
uv sync                              # install deps
uv run python -m pytest -v           # run tests (45 tests)
uv run ruff check                    # lint
uv run ruff format --check           # format check
uv run python -m alembic upgrade head  # run migrations
```

### Frontend

```bash
cd frontend
pnpm install                         # install deps
pnpm dev                             # dev server
pnpm test                            # run tests
pnpm exec tsc --noEmit               # type check
pnpm build                           # production build
```

## Project Structure

```
tripl/
├── compose.yaml              # Docker Compose (postgres, api, frontend)
├── .env.example              # Environment variables template
├── backend/
│   ├── Dockerfile
│   ├── pyproject.toml
│   ├── alembic/              # Database migrations
│   └── src/tripl/
│       ├── main.py           # FastAPI application
│       ├── config.py         # Settings (pydantic-settings)
│       ├── database.py       # Async SQLAlchemy engine
│       ├── models/           # 10 SQLAlchemy models
│       ├── schemas/          # Pydantic request/response schemas
│       ├── services/         # Business logic layer
│       ├── api/v1/           # REST endpoints (7 routers)
│       └── tests/            # pytest (45 tests)
└── frontend/
    ├── Dockerfile
    ├── package.json
    └── src/
        ├── api/              # Typed API client modules
        ├── types/            # TypeScript interfaces
        ├── components/       # Layout, ConfirmDialog
        ├── pages/            # ProjectsPage, EventsPage, ProjectSettingsPage
        └── hooks/            # useConfirm
```

## API Overview

All endpoints are under `/api/v1/`. See `/docs` for the full OpenAPI spec.

| Resource | Endpoints |
|---|---|
| Projects | CRUD (`/projects`) |
| Event Types | CRUD (`/projects/{slug}/event-types`) |
| Field Definitions | CRUD + reorder (`/projects/{slug}/event-types/{id}/fields`) |
| Meta Field Definitions | CRUD (`/projects/{slug}/meta-fields`) |
| Event Type Relations | CRD (`/projects/{slug}/relations`) |
| Events | CRUD + bulk + filtering (`/projects/{slug}/events`) |
| Variables | CRUD (`/projects/{slug}/variables`) |
