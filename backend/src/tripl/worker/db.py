"""Shared sync SQLAlchemy engine + session factory for Celery tasks.

Each worker process creates ONE engine on first use (lazy), then every task
checks out a session from that engine's connection pool. This avoids the
overhead of spinning up a fresh engine per task invocation.

Tests do not touch this module directly — they monkey-patch the
``_get_sync_session`` name inside each task module's globals.
"""

from __future__ import annotations

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from tripl.config import settings

_engine: Engine | None = None
_session_local: sessionmaker[Session] | None = None


def _ensure_initialized() -> sessionmaker[Session]:
    global _engine, _session_local
    if _session_local is None:
        _engine = create_engine(
            settings.sync_database_url,
            echo=settings.debug,
            pool_size=5,
            max_overflow=10,
            pool_pre_ping=True,
            pool_recycle=1800,
        )
        _session_local = sessionmaker(_engine, expire_on_commit=False)
    return _session_local


def SyncSessionLocal() -> Session:  # noqa: N802  — emulates sessionmaker() call shape
    """Return a new sync Session from the shared engine pool."""
    return _ensure_initialized()()
