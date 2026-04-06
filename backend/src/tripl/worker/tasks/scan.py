"""Celery task for running data source scans."""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime

from cryptography.fernet import Fernet
from sqlalchemy import create_engine, delete, select
from sqlalchemy.orm import Session, sessionmaker

from tripl.config import settings
from tripl.models.data_source import DataSource
from tripl.models.event import Event
from tripl.models.event_type import EventType
from tripl.models.scan_config import ScanConfig
from tripl.models.scan_job import ScanJob, ScanJobStatus
from tripl.worker.adapters.base import BaseAdapter
from tripl.worker.adapters.clickhouse import ClickHouseAdapter
from tripl.worker.analyzers.cardinality import analyze_cardinality, analyze_cardinality_grouped
from tripl.worker.analyzers.event_generator import GenerationResult, generate_events
from tripl.worker.celery_app import celery_app

logger = logging.getLogger(__name__)


def _get_sync_session() -> Session:
    engine = create_engine(settings.sync_database_url, echo=settings.debug)
    factory = sessionmaker(engine, expire_on_commit=False)
    return factory()


def _decrypt_password(encrypted: str) -> str:
    if not encrypted:
        return ""
    if not settings.encryption_key:
        # No encryption key configured — password stored as plaintext (dev/test mode)
        return encrypted
    f = Fernet(settings.encryption_key.encode())
    return f.decrypt(encrypted.encode()).decode()


def _build_adapter(ds: DataSource) -> BaseAdapter:
    password = _decrypt_password(ds.password_encrypted)

    if ds.db_type == "clickhouse":
        return ClickHouseAdapter(
            host=ds.host,
            port=ds.port,
            database=ds.database_name,
            username=ds.username,
            password=password,
        )

    msg = f"Unsupported db_type: {ds.db_type}"
    raise ValueError(msg)


@celery_app.task(name="tripl.worker.tasks.scan.run_scan", bind=True, max_retries=0)
def run_scan(self: object, scan_config_id: str, job_id: str) -> dict:
    """Execute a data source scan: connect, analyze columns, detect variables, generate events."""
    session = _get_sync_session()
    adapter: BaseAdapter | None = None

    try:
        # Load scan job and config
        job = session.get(ScanJob, uuid.UUID(job_id))
        if job is None:
            msg = f"ScanJob {job_id} not found"
            raise ValueError(msg)

        config = session.get(ScanConfig, uuid.UUID(scan_config_id))
        if config is None:
            msg = f"ScanConfig {scan_config_id} not found"
            raise ValueError(msg)

        ds = session.get(DataSource, config.data_source_id)
        if ds is None:
            msg = f"DataSource for config {scan_config_id} not found"
            raise ValueError(msg)

        # Mark job as running
        job.status = ScanJobStatus.running.value
        job.started_at = datetime.now(UTC)
        session.commit()

        # Build adapter and connect
        adapter = _build_adapter(ds)
        adapter.test_connection()

        # Get columns from base query
        columns = adapter.get_columns(config.base_query)
        logger.info(f"Found {len(columns)} columns in base query")

        # Clean up existing scan-generated events for this project
        deleted = _cleanup_scan_events(session, config.project_id, config.event_type_id)
        if deleted:
            logger.info(f"Cleaned up {deleted} existing events before scan")

        # Resolve event type: either from config or detect from event_type_column
        event_type_id = config.event_type_id
        logger.info(f"event_type_id={event_type_id}, event_type_column={config.event_type_column!r}")
        if event_type_id is None and config.event_type_column:
            # Event type column groups rows into different event types.
            # Use GROUPING SETS to get per-group cardinalities in one query.
            logger.info("Using grouped scan with GROUPING SETS")
            result = _scan_with_grouping(session, config.project_id, config, adapter, columns)
        elif event_type_id is not None:
            # Single event type scan — bulk cardinality (no grouping)
            analysis = analyze_cardinality(
                adapter,
                config.base_query,
                columns,
                threshold=config.cardinality_threshold,
            )

            event_type = session.get(EventType, event_type_id)
            if event_type is None:
                msg = f"EventType {event_type_id} not found"
                raise ValueError(msg)

            field_defs = {fd.name: fd for fd in event_type.field_definitions}
            result = generate_events(
                session,
                config.project_id,
                event_type_id,
                analysis,
                field_defs,
                cardinality_threshold=config.cardinality_threshold,
                event_type_column=config.event_type_column,
            )
        else:
            msg = "Either event_type_id or event_type_column must be specified"
            raise ValueError(msg)

        session.commit()

        # Mark job as completed
        job.status = ScanJobStatus.completed.value
        job.completed_at = datetime.now(UTC)
        job.result_summary = {
            "events_created": result.events_created,
            "events_skipped": result.events_skipped,
            "variables_created": result.variables_created,
            "columns_analyzed": result.columns_analyzed,
            "details": result.details,
        }
        session.commit()

        logger.info(
            f"Scan completed: {result.events_created} events created, "
            f"{result.events_skipped} skipped, {result.variables_created} variables created"
        )
        return job.result_summary  # type: ignore[return-value]

    except Exception as e:
        logger.exception(f"Scan failed: {e}")
        session.rollback()
        try:
            job = session.get(ScanJob, uuid.UUID(job_id))
            if job:
                job.status = ScanJobStatus.failed.value
                job.completed_at = datetime.now(UTC)
                job.error_message = str(e)
                session.commit()
        except Exception:
            logger.exception("Failed to update job status after error")
        raise
    finally:
        if adapter is not None:
            adapter.close()
        session.close()


def _cleanup_scan_events(
    session: Session,
    project_id: uuid.UUID,
    event_type_id: uuid.UUID | None,
) -> int:
    """Delete existing auto-generated events before a new scan.

    If event_type_id is set, only delete events for that type.
    Otherwise, delete all events in the project with scan-generated description.
    """
    query = delete(Event).where(
        Event.project_id == project_id,
        Event.description == "Auto-generated from data source scan",
    )
    if event_type_id is not None:
        query = query.where(Event.event_type_id == event_type_id)
    result = session.execute(query)
    session.commit()
    return result.rowcount  # type: ignore[return-value]


def _scan_with_grouping(
    session: Session,
    project_id: uuid.UUID,
    config: ScanConfig,
    adapter: BaseAdapter,
    columns: list,
) -> GenerationResult:
    """Handle scans where event_type_column groups rows into different event types.

    Uses GROUPING SETS to compute per-group cardinalities in a single query,
    so a column that is high-cardinality globally may be low-cardinality
    inside a specific group (e.g. event.action within a given event.category).
    """
    col_name = config.event_type_column
    if col_name is None:
        msg = "event_type_column is required for grouped scanning"
        raise ValueError(msg)

    group_values, grouped_results = analyze_cardinality_grouped(
        adapter,
        config.base_query,
        columns,
        group_column=col_name,
        threshold=config.cardinality_threshold,
    )
    logger.info(f"Grouped scan: {len(group_values)} groups found for {col_name!r}")

    combined = GenerationResult()

    for et_value in group_values:
        # Find or skip event type by name
        et = session.execute(
            select(EventType).where(
                EventType.project_id == project_id,
                EventType.name == et_value,
            )
        ).scalar_one_or_none()

        if et is None:
            combined.details.append(f"Skipped event type {et_value!r}: not found in project")
            continue

        field_defs = {fd.name: fd for fd in et.field_definitions}
        # Use per-group cardinality results for this event type
        per_group_analysis = grouped_results[et_value]
        result = generate_events(
            session,
            project_id,
            et.id,
            per_group_analysis,
            field_defs,
            cardinality_threshold=config.cardinality_threshold,
            event_type_column=col_name,
        )
        combined.events_created += result.events_created
        combined.events_skipped += result.events_skipped
        combined.variables_created += result.variables_created
        combined.columns_analyzed = max(combined.columns_analyzed, result.columns_analyzed)
        combined.details.extend(result.details)

    return combined


@celery_app.task(name="tripl.worker.tasks.scan.test_connection", bind=True, max_retries=0)
def test_connection(self: object, data_source_id: str) -> dict:
    """Test connectivity to a data source."""
    session = _get_sync_session()
    adapter: BaseAdapter | None = None
    try:
        ds = session.get(DataSource, uuid.UUID(data_source_id))
        if ds is None:
            return {"success": False, "error": f"DataSource {data_source_id} not found"}

        adapter = _build_adapter(ds)
        ok = adapter.test_connection()
        return {"success": ok, "error": None}
    except Exception as e:
        return {"success": False, "error": str(e)}
    finally:
        if adapter is not None:
            adapter.close()
        session.close()
