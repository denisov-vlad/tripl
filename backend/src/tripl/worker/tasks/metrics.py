"""Celery tasks for collecting time-bucketed event metrics from ClickHouse.

Uses the same cardinality analysis + event generation pipeline as the manual
scan task (analyze_cardinality / generate_events), then collects time-bucketed
counts and matches them to the generated events.
"""

from __future__ import annotations

import json
import logging
import uuid
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta

from sqlalchemy import create_engine, delete, select
from sqlalchemy import func as sa_func
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session, sessionmaker

from tripl.config import settings
from tripl.models.data_source import DataSource
from tripl.models.event import Event
from tripl.models.event_metric import EventMetric
from tripl.models.event_type import EventType
from tripl.models.field_definition import FieldDefinition
from tripl.models.metric_anomaly import MetricAnomaly
from tripl.models.project_anomaly_settings import ProjectAnomalySettings
from tripl.models.scan_config import ScanConfig
from tripl.models.scan_job import ScanJob, ScanJobStatus
from tripl.worker.adapters.base import BaseAdapter, ColumnInfo
from tripl.worker.analyzers.anomaly_detector import (
    SCOPE_EVENT,
    SCOPE_EVENT_TYPE,
    SCOPE_PROJECT_TOTAL,
    AnomalyDetectionSettings,
    DetectedAnomaly,
    SeriesPoint,
    detect_anomalies,
)
from tripl.worker.analyzers.cardinality import (
    _is_json_type,
    analyze_cardinality,
    analyze_cardinality_grouped,
)
from tripl.worker.analyzers.event_generator import (
    GenerationResult,
    _apply_name_format,
    _format_value,
    generate_events,
)
from tripl.worker.celery_app import celery_app
from tripl.worker.utils.intervals import get_interval

logger = logging.getLogger(__name__)
ACTIVE_SCAN_JOB_STATUSES = (
    ScanJobStatus.pending.value,
    ScanJobStatus.running.value,
)


def _get_sync_session() -> Session:
    engine = create_engine(settings.sync_database_url, echo=settings.debug)
    factory = sessionmaker(engine, expire_on_commit=False)
    return factory()


def _decrypt_password(encrypted: str) -> str:
    if not encrypted:
        return ""
    if not settings.encryption_key:
        return encrypted
    from cryptography.fernet import Fernet

    f = Fernet(settings.encryption_key.encode())
    return f.decrypt(encrypted.encode()).decode()


def _build_adapter(ds: DataSource) -> BaseAdapter:
    from tripl.worker.adapters.clickhouse import ClickHouseAdapter

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


def _floor_to_interval(dt: datetime, delta: timedelta) -> datetime:
    """Floor a datetime to the nearest interval boundary."""
    epoch = datetime(2000, 1, 1, tzinfo=UTC)
    total_seconds = delta.total_seconds()
    elapsed = (dt - epoch).total_seconds()
    floored = int(elapsed // total_seconds) * total_seconds
    return epoch + timedelta(seconds=floored)


def _get_active_scan_job(session: Session, scan_config_id: uuid.UUID) -> ScanJob | None:
    """Return the newest pending/running job for a scan config, if any."""
    return session.execute(
        select(ScanJob)
        .where(
            ScanJob.scan_config_id == scan_config_id,
            ScanJob.status.in_(ACTIVE_SCAN_JOB_STATUSES),
        )
        .order_by(ScanJob.created_at.desc())
        .limit(1)
    ).scalar_one_or_none()


def _ensure_event_type_with_fields(
    session: Session,
    project_id: uuid.UUID,
    et_name: str,
    columns: list[ColumnInfo],
    skip_columns: set[str],
) -> EventType:
    """Find or auto-create an EventType with FieldDefinitions for all columns."""
    et = session.execute(
        select(EventType).where(
            EventType.project_id == project_id,
            EventType.name == et_name,
        )
    ).scalar_one_or_none()

    if et is None:
        et = EventType(
            id=uuid.uuid4(),
            project_id=project_id,
            name=et_name,
            display_name=et_name,
            description="Auto-created from metrics collection",
        )
        session.add(et)
        session.flush()
        logger.info(f"Auto-created event type {et_name!r}")

    existing_fds = {fd.name for fd in et.field_definitions}
    for col in columns:
        if col.name in skip_columns:
            continue
        if col.name in existing_fds:
            continue
        fd = FieldDefinition(
            id=uuid.uuid4(),
            event_type_id=et.id,
            name=col.name,
            display_name=col.name,
            field_type="json" if _is_json_type(col.type_name) else "string",
            is_required=False,
            description=f"Auto-created ({col.type_name})",
        )
        session.add(fd)

    session.flush()
    session.refresh(et)
    return et


def _build_event_name_from_row(
    data_row: Sequence[object],
    col_meta: dict[str, dict[str, object]],
    reg_index: dict[str, int],
    json_index: dict[str, int],
    n_reg: int,
    event_name_format: str | None,
) -> str | None:
    """Build event name from a CH row using col_meta (same logic as generate_events)."""
    kwargs: dict[str, str] = {}

    for col_name, meta in col_meta.items():
        if meta.get("is_json"):
            j = json_index.get(col_name)
            if j is None:
                continue
            paths = data_row[n_reg + j]
            if paths:
                if isinstance(paths, (list, tuple)):
                    sorted_paths = sorted(str(p) for p in paths)
                else:
                    sorted_paths = [str(paths)]
                value = json.dumps(
                    {p: f"${{{col_name}.{p}}}" for p in sorted_paths},
                    ensure_ascii=False,
                    sort_keys=True,
                )
            else:
                value = "{}"
        elif meta.get("is_low"):
            i = reg_index.get(col_name)
            if i is None:
                continue
            value = _format_value(data_row[i])
        else:
            # High-cardinality: use template
            template = meta.get("template")
            if not isinstance(template, str):
                continue
            value = template

        kwargs[col_name] = value

    if not kwargs:
        return None

    if event_name_format:
        return _apply_name_format(event_name_format, kwargs)

    parts = []
    for k, v in kwargs.items():
        display = v if len(v) <= 80 else v[:77] + "..."
        parts.append(f"{k}={display}")
    return " | ".join(parts)


def _build_anomaly_settings(
    settings: ProjectAnomalySettings,
) -> AnomalyDetectionSettings:
    return AnomalyDetectionSettings(
        baseline_window_buckets=settings.baseline_window_buckets,
        min_history_buckets=settings.min_history_buckets,
        sigma_threshold=settings.sigma_threshold,
        min_expected_count=settings.min_expected_count,
    )


def _get_project_anomaly_settings(
    session: Session,
    project_id: uuid.UUID,
) -> ProjectAnomalySettings | None:
    return session.execute(
        select(ProjectAnomalySettings).where(ProjectAnomalySettings.project_id == project_id)
    ).scalar_one_or_none()


def _load_scope_points(
    session: Session,
    *,
    scan_config_id: uuid.UUID,
    scope_type: str,
    scope_ref: str,
    history_from: datetime,
    time_to: datetime,
) -> list[SeriesPoint]:
    if scope_type == SCOPE_PROJECT_TOTAL:
        rows = session.execute(
            select(EventMetric.bucket, sa_func.sum(EventMetric.count))
            .where(
                EventMetric.scan_config_id == scan_config_id,
                EventMetric.event_id.is_(None),
                EventMetric.event_type_id.is_not(None),
                EventMetric.bucket >= history_from,
                EventMetric.bucket < time_to,
            )
            .group_by(EventMetric.bucket)
            .order_by(EventMetric.bucket)
        ).all()
        return [SeriesPoint(bucket=bucket, count=int(count)) for bucket, count in rows]

    if scope_type == SCOPE_EVENT_TYPE:
        event_type_id = uuid.UUID(scope_ref)
        rows = session.execute(
            select(EventMetric.bucket, EventMetric.count)
            .where(
                EventMetric.scan_config_id == scan_config_id,
                EventMetric.event_id.is_(None),
                EventMetric.event_type_id == event_type_id,
                EventMetric.bucket >= history_from,
                EventMetric.bucket < time_to,
            )
            .order_by(EventMetric.bucket)
        ).all()
        return [SeriesPoint(bucket=bucket, count=count) for bucket, count in rows]

    event_id = uuid.UUID(scope_ref)
    rows = session.execute(
        select(EventMetric.bucket, EventMetric.count)
        .where(
            EventMetric.scan_config_id == scan_config_id,
            EventMetric.event_id == event_id,
            EventMetric.bucket >= history_from,
            EventMetric.bucket < time_to,
        )
        .order_by(EventMetric.bucket)
    ).all()
    return [SeriesPoint(bucket=bucket, count=count) for bucket, count in rows]


def _replace_scope_anomalies(
    session: Session,
    *,
    scan_config_id: uuid.UUID,
    scope_type: str,
    scope_ref: str,
    evaluation_start: datetime,
    evaluation_end: datetime,
    event_id: uuid.UUID | None,
    event_type_id: uuid.UUID | None,
    anomalies: list[DetectedAnomaly],
) -> int:
    session.execute(
        delete(MetricAnomaly).where(
            MetricAnomaly.scan_config_id == scan_config_id,
            MetricAnomaly.scope_type == scope_type,
            MetricAnomaly.scope_ref == scope_ref,
            MetricAnomaly.bucket >= evaluation_start,
            MetricAnomaly.bucket < evaluation_end,
        )
    )

    for anomaly in anomalies:
        session.add(
            MetricAnomaly(
                id=uuid.uuid4(),
                scan_config_id=scan_config_id,
                scope_type=scope_type,
                scope_ref=scope_ref,
                event_id=event_id,
                event_type_id=event_type_id,
                bucket=anomaly.bucket,
                actual_count=anomaly.actual_count,
                expected_count=anomaly.expected_count,
                stddev=anomaly.stddev,
                z_score=anomaly.z_score,
                direction=anomaly.direction,
            )
        )

    return len(anomalies)


def _collect_scope_ids(
    session: Session,
    *,
    scan_config_id: uuid.UUID,
    history_from: datetime,
    evaluation_start: datetime,
    evaluation_end: datetime,
    scope_type: str,
) -> set[uuid.UUID]:
    metric_column = (
        EventMetric.event_type_id if scope_type == SCOPE_EVENT_TYPE else EventMetric.event_id
    )
    anomaly_column = (
        MetricAnomaly.event_type_id if scope_type == SCOPE_EVENT_TYPE else MetricAnomaly.event_id
    )

    ids = {
        value
        for value in session.execute(
            select(metric_column)
            .where(
                EventMetric.scan_config_id == scan_config_id,
                metric_column.is_not(None),
                EventMetric.bucket >= history_from,
                EventMetric.bucket < evaluation_end,
            )
        ).scalars()
        if value is not None
    }
    ids.update(
        value
        for value in session.execute(
            select(anomaly_column)
            .where(
                MetricAnomaly.scan_config_id == scan_config_id,
                MetricAnomaly.scope_type == scope_type,
                anomaly_column.is_not(None),
                MetricAnomaly.bucket >= evaluation_start,
                MetricAnomaly.bucket < evaluation_end,
            )
        ).scalars()
        if value is not None
    )
    return ids


def _get_active_signal_scope_keys(
    session: Session,
    scan_config_id: uuid.UUID,
) -> set[tuple[str, str]]:
    latest_metrics: dict[tuple[str, str], datetime] = {}

    latest_project_total_bucket = session.execute(
        select(sa_func.max(EventMetric.bucket)).where(
            EventMetric.scan_config_id == scan_config_id,
            EventMetric.event_id.is_(None),
            EventMetric.event_type_id.is_not(None),
        )
    ).scalar_one_or_none()
    if latest_project_total_bucket is not None:
        latest_metrics[(SCOPE_PROJECT_TOTAL, str(scan_config_id))] = latest_project_total_bucket

    for event_type_id, bucket in session.execute(
        select(EventMetric.event_type_id, sa_func.max(EventMetric.bucket))
        .where(
            EventMetric.scan_config_id == scan_config_id,
            EventMetric.event_id.is_(None),
            EventMetric.event_type_id.is_not(None),
        )
        .group_by(EventMetric.event_type_id)
    ).all():
        if event_type_id is not None:
            latest_metrics[(SCOPE_EVENT_TYPE, str(event_type_id))] = bucket

    for event_id, bucket in session.execute(
        select(EventMetric.event_id, sa_func.max(EventMetric.bucket))
        .where(
            EventMetric.scan_config_id == scan_config_id,
            EventMetric.event_id.is_not(None),
        )
        .group_by(EventMetric.event_id)
    ).all():
        if event_id is not None:
            latest_metrics[(SCOPE_EVENT, str(event_id))] = bucket

    latest_anomalies: dict[tuple[str, str], MetricAnomaly] = {}
    for anomaly in session.execute(
        select(MetricAnomaly)
        .where(MetricAnomaly.scan_config_id == scan_config_id)
        .order_by(MetricAnomaly.bucket.desc())
    ).scalars():
        key = (anomaly.scope_type, anomaly.scope_ref)
        latest_anomalies.setdefault(key, anomaly)

    return {
        key
        for key, anomaly in latest_anomalies.items()
        if (latest_metric_bucket := latest_metrics.get(key)) is None
        or anomaly.bucket >= latest_metric_bucket
    }


def _recalculate_metric_anomalies(
    session: Session,
    config: ScanConfig,
    *,
    evaluation_start: datetime,
    evaluation_end: datetime,
) -> int:
    project_settings = _get_project_anomaly_settings(session, config.project_id)
    if project_settings is None or not project_settings.anomaly_detection_enabled:
        session.execute(
            delete(MetricAnomaly).where(MetricAnomaly.scan_config_id == config.id)
        )
        session.flush()
        return 0

    if not config.interval:
        return 0

    interval_spec = get_interval(config.interval)
    history_from = (
        evaluation_start - interval_spec.delta * project_settings.baseline_window_buckets
    )
    settings = _build_anomaly_settings(project_settings)
    anomalies_detected = 0

    if project_settings.detect_project_total:
        points = _load_scope_points(
            session,
            scan_config_id=config.id,
            scope_type=SCOPE_PROJECT_TOTAL,
            scope_ref=str(config.id),
            history_from=history_from,
            time_to=evaluation_end,
        )
        anomalies_detected += _replace_scope_anomalies(
            session,
            scan_config_id=config.id,
            scope_type=SCOPE_PROJECT_TOTAL,
            scope_ref=str(config.id),
            evaluation_start=evaluation_start,
            evaluation_end=evaluation_end,
            event_id=None,
            event_type_id=None,
            anomalies=detect_anomalies(
                points,
                interval=interval_spec.delta,
                evaluation_start=evaluation_start,
                evaluation_end=evaluation_end,
                settings=settings,
            ),
        )
    else:
        session.execute(
            delete(MetricAnomaly).where(
                MetricAnomaly.scan_config_id == config.id,
                MetricAnomaly.scope_type == SCOPE_PROJECT_TOTAL,
                MetricAnomaly.bucket >= evaluation_start,
                MetricAnomaly.bucket < evaluation_end,
            )
        )

    if project_settings.detect_event_types:
        for event_type_id in _collect_scope_ids(
            session,
            scan_config_id=config.id,
            history_from=history_from,
            evaluation_start=evaluation_start,
            evaluation_end=evaluation_end,
            scope_type=SCOPE_EVENT_TYPE,
        ):
            scope_ref = str(event_type_id)
            points = _load_scope_points(
                session,
                scan_config_id=config.id,
                scope_type=SCOPE_EVENT_TYPE,
                scope_ref=scope_ref,
                history_from=history_from,
                time_to=evaluation_end,
            )
            anomalies_detected += _replace_scope_anomalies(
                session,
                scan_config_id=config.id,
                scope_type=SCOPE_EVENT_TYPE,
                scope_ref=scope_ref,
                evaluation_start=evaluation_start,
                evaluation_end=evaluation_end,
                event_id=None,
                event_type_id=event_type_id,
                anomalies=detect_anomalies(
                    points,
                    interval=interval_spec.delta,
                    evaluation_start=evaluation_start,
                    evaluation_end=evaluation_end,
                    settings=settings,
                ),
            )
    else:
        session.execute(
            delete(MetricAnomaly).where(
                MetricAnomaly.scan_config_id == config.id,
                MetricAnomaly.scope_type == SCOPE_EVENT_TYPE,
                MetricAnomaly.bucket >= evaluation_start,
                MetricAnomaly.bucket < evaluation_end,
            )
        )

    if project_settings.detect_events:
        for event_id in _collect_scope_ids(
            session,
            scan_config_id=config.id,
            history_from=history_from,
            evaluation_start=evaluation_start,
            evaluation_end=evaluation_end,
            scope_type=SCOPE_EVENT,
        ):
            scope_ref = str(event_id)
            points = _load_scope_points(
                session,
                scan_config_id=config.id,
                scope_type=SCOPE_EVENT,
                scope_ref=scope_ref,
                history_from=history_from,
                time_to=evaluation_end,
            )
            anomalies_detected += _replace_scope_anomalies(
                session,
                scan_config_id=config.id,
                scope_type=SCOPE_EVENT,
                scope_ref=scope_ref,
                evaluation_start=evaluation_start,
                evaluation_end=evaluation_end,
                event_id=event_id,
                event_type_id=None,
                anomalies=detect_anomalies(
                    points,
                    interval=interval_spec.delta,
                    evaluation_start=evaluation_start,
                    evaluation_end=evaluation_end,
                    settings=settings,
                ),
            )
    else:
        session.execute(
            delete(MetricAnomaly).where(
                MetricAnomaly.scan_config_id == config.id,
                MetricAnomaly.scope_type == SCOPE_EVENT,
                MetricAnomaly.bucket >= evaluation_start,
                MetricAnomaly.bucket < evaluation_end,
            )
        )

    session.flush()
    return anomalies_detected


def _upsert_event_metrics_rows(
    session: Session,
    *,
    rows: list[dict[str, object]],
    constraint: str,
) -> None:
    if not rows:
        return

    if session.bind is not None and session.bind.dialect.name == "sqlite":
        stmt = sqlite_insert(EventMetric).values(rows)
        stmt = stmt.on_conflict_do_update(
            index_elements=["scan_config_id", "event_id", "bucket"]
            if constraint == "uq_event_metric_config_event_bucket"
            else ["scan_config_id", "event_type_id", "bucket"],
            set_={"count": stmt.excluded.count},
        )
        session.execute(stmt)
        return

    stmt = pg_insert(EventMetric).values(rows)
    stmt = stmt.on_conflict_do_update(
        constraint=constraint,
        set_={"count": stmt.excluded.count},
    )
    session.execute(stmt)


@celery_app.task(  # type: ignore[untyped-decorator]
    name="tripl.worker.tasks.metrics.collect_metrics",
    bind=True,
    max_retries=0,
)
def collect_metrics(
    self: object,
    scan_config_id: str,
    job_id: str | None = None,
) -> dict[str, object]:
    """Collect time-bucketed event counts from ClickHouse and store in event_metrics.

    Phase 1: sync events using the exact same pipeline as the manual scan
             (analyze_cardinality + generate_events).
    Phase 2: query time-bucketed counts, match rows to events, UPSERT metrics.
    """
    session = _get_sync_session()
    adapter = None
    job: ScanJob | None = None

    try:
        config = session.get(ScanConfig, uuid.UUID(scan_config_id))
        if config is None:
            msg = f"ScanConfig {scan_config_id} not found"
            raise ValueError(msg)

        if not config.time_column or not config.interval:
            logger.info(f"ScanConfig {scan_config_id}: time_column or interval not set, skipping")
            return {"skipped": True}

        if job_id is not None:
            job = session.get(ScanJob, uuid.UUID(job_id))
            if job is None:
                msg = f"ScanJob {job_id} not found"
                raise ValueError(msg)
            if job.scan_config_id != config.id:
                msg = f"ScanJob {job_id} does not belong to ScanConfig {scan_config_id}"
                raise ValueError(msg)

            job.status = ScanJobStatus.running.value
            job.started_at = job.started_at or datetime.now(UTC)
            job.completed_at = None
            job.error_message = None
        else:
            job = ScanJob(
                id=uuid.uuid4(),
                scan_config_id=config.id,
                status=ScanJobStatus.running.value,
                started_at=datetime.now(UTC),
            )
            session.add(job)
        session.commit()

        active_signals_before = _get_active_signal_scope_keys(session, config.id)

        ds = session.get(DataSource, config.data_source_id)
        if ds is None:
            msg = f"DataSource for config {scan_config_id} not found"
            raise ValueError(msg)

        adapter = _build_adapter(ds)
        adapter.test_connection()

        # Get columns (same as scan task)
        columns = adapter.get_columns(config.base_query)
        if config.time_column:
            columns = [c for c in columns if c.name != config.time_column]
        logger.info(f"Found {len(columns)} columns in base query")

        skip_cols = set()
        if config.event_type_column:
            skip_cols.add(config.event_type_column)
        if config.time_column:
            skip_cols.add(config.time_column)

        # ---- PHASE 1: Sync events via exact scan pipeline ----

        gen_results: dict[str, GenerationResult] = {}
        single_result: GenerationResult | None = None

        if config.event_type_column:
            # Grouped scan: same as _scan_with_grouping in scan.py
            group_values, grouped_analyses = analyze_cardinality_grouped(
                adapter,
                config.base_query,
                columns,
                group_column=config.event_type_column,
                threshold=config.cardinality_threshold,
            )
            logger.info(
                f"Grouped scan: {len(group_values)} groups for {config.event_type_column!r}"
            )

            for et_name in group_values:
                et = _ensure_event_type_with_fields(
                    session,
                    config.project_id,
                    et_name,
                    columns,
                    skip_cols,
                )
                field_defs = {fd.name: fd for fd in et.field_definitions}
                result = generate_events(
                    session,
                    config.project_id,
                    et.id,
                    grouped_analyses[et_name],
                    field_defs,
                    cardinality_threshold=config.cardinality_threshold,
                    event_type_column=config.event_type_column,
                    time_column=config.time_column,
                    event_name_format=config.event_name_format,
                )
                gen_results[et_name] = result
                logger.info(
                    f"  {et_name!r}: {result.events_created} created, "
                    f"{result.events_skipped} updated"
                )

        elif config.event_type_id:
            # Single event type: same as run_scan single-type path
            analysis = analyze_cardinality(
                adapter,
                config.base_query,
                columns,
                threshold=config.cardinality_threshold,
            )

            event_type = session.get(EventType, config.event_type_id)
            if event_type is None:
                msg = f"EventType {config.event_type_id} not found"
                raise ValueError(msg)

            field_defs = {fd.name: fd for fd in event_type.field_definitions}
            single_result = generate_events(
                session,
                config.project_id,
                config.event_type_id,
                analysis,
                field_defs,
                cardinality_threshold=config.cardinality_threshold,
                event_type_column=config.event_type_column,
                time_column=config.time_column,
                event_name_format=config.event_name_format,
            )
            logger.info(
                f"Single scan: {single_result.events_created} created, "
                f"{single_result.events_skipped} updated"
            )
        else:
            msg = "Either event_type_id or event_type_column must be specified"
            raise ValueError(msg)

        session.commit()

        # ---- PHASE 2: Collect time-bucketed metrics ----

        assert config.interval is not None
        interval_spec = get_interval(config.interval)
        delta = interval_spec.delta
        now = datetime.now(UTC)
        time_to = _floor_to_interval(now, delta)

        last_bucket = session.execute(
            select(sa_func.max(EventMetric.bucket)).where(
                EventMetric.scan_config_id == config.id,
            )
        ).scalar()

        time_from = last_bucket - delta if last_bucket is not None else time_to - delta * 30

        logger.info(
            f"Collecting metrics: {time_from.isoformat()} to {time_to.isoformat()}, "
            f"interval={config.interval}"
        )

        # Split columns for the CH query (same split as cardinality.py uses)
        regular_cols = [c.name for c in columns if not _is_json_type(c.type_name)]
        json_cols = [c.name for c in columns if _is_json_type(c.type_name)]

        col_names, rows = adapter.get_time_bucketed_counts(
            config.base_query,
            config.time_column,
            interval_spec.ch_interval,
            regular_cols,
            json_cols,
            time_from,
            time_to,
        )
        logger.info(f"Got {len(rows)} bucketed rows from ClickHouse")

        # Collect totals from Phase 1 for result_summary
        total_created = 0
        total_skipped = 0
        total_vars = 0
        total_cols = 0
        all_details: list[str] = []
        if single_result:
            total_created += single_result.events_created
            total_skipped += single_result.events_skipped
            total_vars += single_result.variables_created
            total_cols = max(total_cols, single_result.columns_analyzed)
            all_details.extend(single_result.details)
        for gr in gen_results.values():
            total_created += gr.events_created
            total_skipped += gr.events_skipped
            total_vars += gr.variables_created
            total_cols = max(total_cols, gr.columns_analyzed)
            all_details.extend(gr.details)

        if not rows:
            anomalies_detected = _recalculate_metric_anomalies(
                session,
                config,
                evaluation_start=time_from,
                evaluation_end=time_to,
            )
            signals_added = len(
                _get_active_signal_scope_keys(session, config.id) - active_signals_before
            )
            result_summary = {
                "events_created": total_created,
                "events_skipped": total_skipped,
                "variables_created": total_vars,
                "columns_analyzed": total_cols,
                "event_metrics": 0,
                "type_metrics": 0,
                "anomalies_detected": anomalies_detected,
                "signals_added": signals_added,
                "details": all_details,
            }
            if job:
                job.status = ScanJobStatus.completed.value
                job.completed_at = datetime.now(UTC)
                job.result_summary = result_summary
                session.commit()
            return result_summary

        # Build indices for row navigation (same layout as BreakdownAnalysis)
        reg_index = {name: i for i, name in enumerate(regular_cols)}
        json_index = {name: i for i, name in enumerate(json_cols)}
        n_reg = len(regular_cols)

        # Event type lookup (for grouped mode)
        et_by_name: dict[str, EventType] = {}
        if config.event_type_column:
            all_ets = (
                session.execute(select(EventType).where(EventType.project_id == config.project_id))
                .scalars()
                .all()
            )
            et_by_name = {et.name: et for et in all_ets}

        # Aggregate metrics: (scan_config_id, event_id, bucket) -> count
        event_agg: dict[tuple[uuid.UUID, uuid.UUID, datetime], int] = {}
        # (scan_config_id, event_type_id, bucket) -> count
        type_agg: dict[tuple[uuid.UUID, uuid.UUID, datetime], int] = {}

        et_col_idx = reg_index.get(config.event_type_column) if config.event_type_column else None

        for row in rows:
            bucket = row[0]
            data_row = row[1:]  # strip _bucket; _cnt is at the end but not indexed by col_meta
            cnt = row[-1]
            col_meta: dict[str, dict[str, object]]
            events_by_name: dict[str, object]
            event_type_id: uuid.UUID | None

            # Determine event type and get the matching gen result
            if config.event_type_column and et_col_idx is not None:
                et_name = str(data_row[et_col_idx])
                event_type = et_by_name.get(et_name)
                if event_type is None:
                    continue
                event_type_id = event_type.id
                gen_result: GenerationResult | None = gen_results.get(et_name)
                if gen_result is None:
                    continue
                col_meta = gen_result.col_meta
                events_by_name = gen_result.events_by_name
            else:
                event_type_id = config.event_type_id
                if single_result is None:
                    continue
                col_meta = single_result.col_meta
                events_by_name = single_result.events_by_name

            # Build event name from row (same logic as generate_events)
            event_name = _build_event_name_from_row(
                data_row,
                col_meta,
                reg_index,
                json_index,
                n_reg,
                config.event_name_format,
            )

            if event_name:
                ev = events_by_name.get(event_name)
                if isinstance(ev, Event):
                    key = (config.id, ev.id, bucket)
                    event_agg[key] = event_agg.get(key, 0) + cnt

            if event_type_id:
                key = (config.id, event_type_id, bucket)
                type_agg[key] = type_agg.get(key, 0) + cnt

        # Build metrics rows for UPSERT
        event_rows = [
            {
                "id": uuid.uuid4(),
                "scan_config_id": sc_id,
                "event_id": ev_id,
                "event_type_id": None,
                "bucket": bucket,
                "count": total,
            }
            for (sc_id, ev_id, bucket), total in event_agg.items()
        ]
        type_rows = [
            {
                "id": uuid.uuid4(),
                "scan_config_id": sc_id,
                "event_id": None,
                "event_type_id": et_id,
                "bucket": bucket,
                "count": total,
            }
            for (sc_id, et_id, bucket), total in type_agg.items()
        ]

        _upsert_event_metrics_rows(
            session,
            rows=event_rows,
            constraint="uq_event_metric_config_event_bucket",
        )
        _upsert_event_metrics_rows(
            session,
            rows=type_rows,
            constraint="uq_event_metric_config_type_bucket",
        )

        session.commit()

        n_ev = len(event_rows)
        n_tp = len(type_rows)
        logger.info(f"Upserted {n_ev} event metrics + {n_tp} type metrics")
        anomalies_detected = _recalculate_metric_anomalies(
            session,
            config,
            evaluation_start=time_from,
            evaluation_end=time_to,
        )
        signals_added = len(
            _get_active_signal_scope_keys(session, config.id) - active_signals_before
        )

        result_summary = {
            "events_created": total_created,
            "events_skipped": total_skipped,
            "variables_created": total_vars,
            "columns_analyzed": total_cols,
            "event_metrics": n_ev,
            "type_metrics": n_tp,
            "anomalies_detected": anomalies_detected,
            "signals_added": signals_added,
            "details": all_details,
        }

        if job:
            job.status = ScanJobStatus.completed.value
            job.completed_at = datetime.now(UTC)
            job.result_summary = result_summary
            session.commit()

        return result_summary

    except Exception as exc:
        logger.exception(f"Metrics collection failed for {scan_config_id}")
        if job:
            try:
                job.status = ScanJobStatus.failed.value
                job.completed_at = datetime.now(UTC)
                job.error_message = str(exc)
                session.commit()
            except Exception:
                session.rollback()
        else:
            session.rollback()
        raise
    finally:
        if adapter is not None:
            adapter.close()
        session.close()


@celery_app.task(name="tripl.worker.tasks.metrics.check_metrics_due")  # type: ignore[untyped-decorator]
def check_metrics_due() -> dict[str, int]:
    """Check which scan configs are due for metrics collection and dispatch tasks."""
    session = _get_sync_session()
    try:
        configs = (
            session.execute(
                select(ScanConfig).where(
                    ScanConfig.interval.isnot(None),
                    ScanConfig.time_column.isnot(None),
                )
            )
            .scalars()
            .all()
        )

        dispatched = 0
        for config in configs:
            active_job = _get_active_scan_job(session, config.id)
            if active_job is not None:
                logger.info(
                    f"Skipping collect_metrics for {config.name!r}: "
                    f"active job {active_job.id} is {active_job.status}"
                )
                continue

            assert config.interval is not None
            interval_spec = get_interval(config.interval)
            delta = interval_spec.delta

            # Check last metric bucket for this config
            last_bucket = session.execute(
                select(sa_func.max(EventMetric.bucket)).where(
                    EventMetric.scan_config_id == config.id,
                )
            ).scalar()

            now = datetime.now(UTC)
            should_run = False

            if last_bucket is None:
                # Never collected — run now
                should_run = True
            else:
                # Only dispatch when a new complete bucket is available.
                # The latest complete bucket is floor(now) - delta.
                latest_complete = _floor_to_interval(now, delta) - delta
                if last_bucket < latest_complete:
                    should_run = True

            if should_run:
                job = ScanJob(
                    id=uuid.uuid4(),
                    scan_config_id=config.id,
                    status=ScanJobStatus.pending.value,
                )
                session.add(job)
                session.commit()

                logger.info(
                    f"Dispatching collect_metrics for {config.name!r} (interval={config.interval})"
                )
                try:
                    collect_metrics.delay(str(config.id), str(job.id))
                except Exception as exc:
                    job.status = ScanJobStatus.failed.value
                    job.completed_at = datetime.now(UTC)
                    job.error_message = f"Failed to dispatch collect_metrics: {exc}"
                    session.commit()
                    raise
                dispatched += 1

        logger.info(f"check_metrics_due: {len(configs)} configs checked, {dispatched} dispatched")
        return {"checked": len(configs), "dispatched": dispatched}

    except Exception:
        logger.exception("check_metrics_due failed")
        raise
    finally:
        session.close()
