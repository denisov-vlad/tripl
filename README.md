# tripl

Analytics tracking-plan, monitoring, and alerting service.

## What It Does

`tripl` gives product and analytics teams one place to define what should be tracked, compare that plan with what is actually flowing through analytics storage, and react when volume changes look suspicious.

Current product scope includes:

- session-based authentication;
- project-based tracking plans;
- event types, fields, relations, meta fields, and reusable variables;
- event catalog management with implementation, review, archive, and tag workflows;
- external data sources, currently ClickHouse;
- async scan jobs via Celery + RabbitMQ;
- metrics collection into PostgreSQL;
- anomaly detection for project-total, event-type, and event scopes;
- alert destinations, rules, message templates, and delivery history for Slack and Telegram;
- frontend workspace pages for catalog, settings, monitoring, data sources, and alerting.

## Architecture

- Backend: FastAPI, SQLAlchemy async, PostgreSQL, Alembic
- Worker: Celery, RabbitMQ, ClickHouse adapter, anomaly/scan analyzers
- Frontend: React 19, TypeScript, Vite, Tailwind CSS 4, TanStack Query, Recharts
- Local runtime: Docker Compose for `postgres`, `rabbitmq`, `api`, `celery-worker`, `celery-beat`, and `frontend`

Important runtime notes:

- ClickHouse is external and is not started by Compose.
- The API runs `alembic upgrade head` before serving requests.
- Metrics collection scheduling is handled by Celery beat.
- API health endpoint: `GET /health`

## Quick Start

```bash
cp .env.example .env
docker compose up -d --build
```

Open the frontend, create the first account on the sign-in page, and the app will establish an HTTP-only session cookie for subsequent API access.

Endpoints:

- Frontend: http://localhost:5173
- API: http://localhost:8000
- API docs: http://localhost:8000/docs
- RabbitMQ management: http://localhost:15672

## Development

Backend:

```bash
cd backend
uv sync
uv run pytest
uv run ruff check
uv run mypy
```

Frontend:

```bash
cd frontend
pnpm install
pnpm test
pnpm exec tsc --noEmit
pnpm lint
```

Docker hot reload:

```bash
docker compose up --build --watch
```

What reloads automatically:

- frontend `src` and `public`: synced into the container and handled by Vite HMR;
- backend `src`: synced into the API container and reloaded by `uvicorn --reload`;
- Celery worker and beat: synced backend changes trigger container restart;
- `package.json`, `pnpm-lock.yaml`, `pyproject.toml`, `uv.lock`, and Dockerfiles: trigger image rebuild.

## Documentation

- [CONTRIBUTING.md](CONTRIBUTING.md): local setup, commands, and API overview
- [PLAN.md](PLAN.md): product scope, architecture map, and future roadmap
- [AGENTS.md](AGENTS.md): repo navigation map for coding agents
