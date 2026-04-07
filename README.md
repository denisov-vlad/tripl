# tripl

Analytics tracking plan service — a single source of truth for what your product tracks and why.

## What it does

tripl helps teams manage their analytics tracking plan: define event schemas, track implementation status, and keep the catalog in sync with real data flowing through your analytics pipeline.

### Event Catalog

Create **projects**, each with its own set of **event types** (e.g. page views, clicks, transactions). Each event type has configurable **field definitions** (with types like string, enum, boolean, JSON) and **relations** to other event types. Individual **events** are instances within a type, carrying field values, tags, meta values, and implementation/review status.

### Data Source Scanning

Connect to analytics databases (currently ClickHouse) and let tripl analyze what's actually being tracked. The scan system:

- Runs a configurable SQL query against your data source
- Analyzes column cardinality to distinguish categorical fields from high-cardinality ones
- Auto-generates events with proper field values, deduplicating against existing entries
- Detects variable patterns in high-cardinality columns and creates `${variable}` placeholders
- Parses JSON columns and maps their key paths

Scans run asynchronously via Celery workers, so the API stays responsive.

### Review Workflow

Events have `implemented` and `reviewed` flags. Scan-generated events land as implemented but unreviewed, with a dedicated **Review** tab to triage new entries. Events can also be **archived** to keep the catalog clean without losing history.

## Stack

- **Backend**: Python 3.13 · FastAPI · SQLAlchemy (async) · Alembic · PostgreSQL
- **Worker**: Celery · RabbitMQ · ClickHouse integration
- **Frontend**: React 19 · TypeScript · Vite · Tailwind CSS · TanStack React Query · React Router
- **Infrastructure**: Docker Compose (postgres, rabbitmq, api, celery-worker, celery-beat, frontend/nginx)

## Quick Start

```bash
cp .env.example .env
docker compose up -d --build
```

- **Frontend** → http://localhost:5173
- **API** → http://localhost:8000
- **API docs** → http://localhost:8000/docs

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, project structure, and API reference.
