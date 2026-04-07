# Contributing

## Development Setup

```bash
cp .env.example .env
docker compose up -d --build
```

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| API | http://localhost:8000 |
| API docs (Swagger) | http://localhost:8000/docs |
| RabbitMQ management | http://localhost:15672 |

### Backend

```bash
cd backend
uv sync                              # install deps
uv run pytest -v                     # run tests
uv run ruff check                    # lint
uv run ruff format --check           # format check
uv run alembic upgrade head          # run migrations
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

### Docker Compose Services

| Service | Description |
|---|---|
| `postgres` | PostgreSQL 17, port 5432 |
| `rabbitmq` | RabbitMQ 3 with management UI, ports 5672/15672 |
| `api` | FastAPI backend, port 8000 |
| `celery-worker` | Celery worker for async scan tasks |
| `celery-beat` | Celery beat scheduler |
| `frontend` | Vite build served by nginx, port 5173 |

## Project Structure

```
tripl/
├── compose.yaml              # Docker Compose
├── .env.example              # Environment variables template
├── backend/
│   ├── Dockerfile
│   ├── pyproject.toml
│   ├── alembic/              # Database migrations (8 migrations)
│   └── src/tripl/
│       ├── main.py           # FastAPI application
│       ├── config.py         # Settings (pydantic-settings)
│       ├── database.py       # Async SQLAlchemy engine
│       ├── models/           # 13 SQLAlchemy models
│       ├── schemas/          # Pydantic request/response schemas
│       ├── services/         # Business logic layer (9 services)
│       ├── api/v1/           # REST endpoints (9 routers)
│       ├── tests/            # pytest (11 test modules)
│       └── worker/
│           ├── celery_app.py # Celery application
│           ├── tasks/        # Celery tasks (scan)
│           ├── adapters/     # Data source adapters (ClickHouse)
│           └── analyzers/    # Cardinality analysis, event generation, variable detection
└── frontend/
    ├── Dockerfile
    ├── nginx.conf            # Nginx reverse proxy config
    ├── package.json
    └── src/
        ├── api/              # Typed API client modules (10 modules)
        ├── types/            # TypeScript interfaces
        ├── components/       # Layout, sidebar, UI primitives (shadcn/ui)
        ├── pages/            # ProjectsPage, EventsPage, DataSourcesPage, ProjectSettingsPage
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
| Data Sources | CRUD + test connection (`/data-sources`) |
| Scan Configs | CRUD (`/projects/{slug}/scan-configs`) |
| Scan Jobs | Create + list + status (`/projects/{slug}/scan-jobs`) |

## PR Guidelines

- Title format: `[analytics] <Title>`
- Summarize any changes to API contracts, event schemas, task queues, schedules, or environment variables.
- Before merging, run backend checks (`uv run pytest`, `uv run ruff check`) and frontend checks (`pnpm test`, `pnpm exec tsc --noEmit`).
