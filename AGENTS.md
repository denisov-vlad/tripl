# AGENTS.md

## Project overview
- **tripl** — analytics tracking plan service. See [PLAN.md](PLAN.md) for full architecture, data model, API spec, and implementation roadmap.
- Phase 1 (done): event catalog — CRUD for projects, event types, configurable fields, meta fields, relations, events, variables.
- Phase 2 (in progress): analytics DB integration (ClickHouse via data sources), Celery+RabbitMQ scan pipeline, auto-generated events from cardinality analysis.
- Phase 3 (future): validation checks, alerting, scheduled scans.

## Project scope
- This project is an analytics tracking platform.
- The backend standard is `uv` with Python `3.13`.
- The API standard is FastAPI, and agents should prefer the latest stable FastAPI-compatible patterns already supported by the lockfile.
- The frontend standard is a modern `pnpm`-managed TypeScript stack. Prefer current stable tooling such as Vite, React, and Vitest unless the repo already establishes a different frontend baseline.
- The full local runtime should be defined in Docker Compose. Prefer running services through `docker compose` instead of ad hoc local processes when possible.
- Background jobs and scheduled workloads should use Celery with RabbitMQ. The scan pipeline is already implemented with a Celery worker and beat scheduler.

## Dev environment tips
- Use `uv` for all backend package management, virtualenv management, and command execution. Do not introduce `pipenv`, `poetry`, or bare `pip` workflows unless the repo already requires them.
- Pin and verify Python `3.13` in backend config files such as `.python-version`, `pyproject.toml`, Dockerfiles, and Compose services when those files exist.
- For backend dependencies, prefer commands like `uv add <package>` and `uv sync`.
- For backend commands, prefer `uv run <command>` such as `uv run uvicorn ...`, `uv run pytest`, or `uv run alembic upgrade head`.
- For frontend package management, use `pnpm` only.
- If a frontend app needs to be created, prefer a current stable `pnpm`-installed React + TypeScript setup and keep the choice consistent with the existing repo structure.
- Keep Dockerfiles, `.dockerignore`, and `compose.yaml` or `docker-compose.yml` aligned with actual service names and ports.
- Treat Docker Compose as the source of truth for wiring API, frontend, RabbitMQ, Celery workers, and any supporting services.
- Keep environment variable names synchronized across app config, Compose files, and `.env.example`.

## Architecture guidance
- Keep the FastAPI app thin at the HTTP layer: request validation, auth, and response shaping belong in the API layer; business logic should live in services.
- Model analytics ingestion and processing so request/response paths stay fast. Push heavy or retryable work to Celery tasks.
- Use RabbitMQ as the Celery broker unless the repo explicitly introduces a separate result backend requirement.
- Put scheduled jobs on Celery beat or an equivalent Celery-native scheduler when scheduling is needed.
- Design Compose services so they can be started together for local development: `api`, `frontend`, `rabbitmq`, `celery-worker`, and `celery-beat` are the expected defaults unless the repo chooses different names.
- Prefer structured configuration and explicit health checks for API, worker, and broker containers.

## Testing instructions
- Run backend tests with `uv run pytest`.
- Run backend linting and type checks with the tools configured in `pyproject.toml`; common commands are `uv run ruff check`, `uv run ruff format --check`, and `uv run mypy`.
- Run frontend checks with `pnpm lint`, `pnpm test`, and `pnpm exec tsc --noEmit` unless the package scripts define stricter wrappers.
- When changing Docker or Compose setup, validate with `docker compose config` and bring the relevant stack up locally if feasible.
- When changing Celery or RabbitMQ integration, verify both the worker startup path and at least one real task execution path.
- Add or update tests for the code you change, including API, task, and frontend behavior where relevant.

## PR instructions
- Title format: `[analytics] <Title>`
- Summarize any changes to API contracts, event schemas, task queues, schedules, or environment variables.
- Before finishing, run the relevant backend checks with `uv`, the relevant frontend checks with `pnpm`, and any affected Docker Compose validation commands.
