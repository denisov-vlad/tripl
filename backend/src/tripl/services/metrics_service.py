"""Service for querying event metrics and anomaly signals from PostgreSQL."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from tripl.models.event import Event
from tripl.models.event_metric import EventMetric
from tripl.models.event_tag import EventTag
from tripl.models.event_type import EventType
from tripl.models.metric_anomaly import MetricAnomaly
from tripl.models.project import Project
from tripl.models.scan_config import ScanConfig
from tripl.schemas.event_metric import (
    EventMetricPoint,
    EventMetricsResponse,
    EventWindowMetricsResponse,
    MetricSignalResponse,
)
from tripl.worker.analyzers.anomaly_detector import (
    SCOPE_EVENT,
    SCOPE_EVENT_TYPE,
    SCOPE_PROJECT_TOTAL,
    SeriesPoint,
    expand_series,
)
from tripl.worker.utils.intervals import get_interval

RECENT_SIGNAL_WINDOW = timedelta(hours=24)


async def _resolve_project(session: AsyncSession, slug: str) -> Project:
    result = await session.execute(select(Project).where(Project.slug == slug))
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(404, f"Project '{slug}' not found")
    return project


async def _resolve_event(
    session: AsyncSession,
    project_id: uuid.UUID,
    event_id: uuid.UUID,
) -> Event:
    event = await session.get(Event, event_id)
    if event is None or event.project_id != project_id:
        raise HTTPException(404, "Event not found")
    return event


async def _resolve_event_type(
    session: AsyncSession,
    project_id: uuid.UUID,
    event_type_id: uuid.UUID,
) -> EventType:
    event_type = await session.get(EventType, event_type_id)
    if event_type is None or event_type.project_id != project_id:
        raise HTTPException(404, "Event type not found")
    return event_type


async def _get_project_interval(session: AsyncSession, project_id: uuid.UUID) -> str | None:
    result = await session.execute(
        select(ScanConfig.interval)
        .where(
            ScanConfig.project_id == project_id,
            ScanConfig.interval.isnot(None),
        )
        .limit(1)
    )
    return result.scalar_one_or_none()


async def _get_scan_config_interval(
    session: AsyncSession,
    scan_config_id: uuid.UUID | None,
) -> str | None:
    if scan_config_id is None:
        return None
    result = await session.execute(
        select(ScanConfig.interval).where(ScanConfig.id == scan_config_id)
    )
    return result.scalar_one_or_none()


async def _get_default_scan_config_id(
    session: AsyncSession,
    project_id: uuid.UUID,
) -> uuid.UUID | None:
    result = await session.execute(
        select(ScanConfig.id)
        .where(
            ScanConfig.project_id == project_id,
            ScanConfig.interval.isnot(None),
            ScanConfig.time_column.isnot(None),
        )
        .order_by(ScanConfig.updated_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def _resolve_scope_scan_config_id(
    session: AsyncSession,
    project_id: uuid.UUID,
    *,
    event_id: uuid.UUID | None = None,
    event_type_id: uuid.UUID | None = None,
) -> uuid.UUID | None:
    metric_query = (
        select(EventMetric.scan_config_id, EventMetric.bucket)
        .join(ScanConfig, ScanConfig.id == EventMetric.scan_config_id)
        .where(ScanConfig.project_id == project_id)
    )
    anomaly_query = (
        select(MetricAnomaly.scan_config_id, MetricAnomaly.bucket)
        .join(ScanConfig, ScanConfig.id == MetricAnomaly.scan_config_id)
        .where(ScanConfig.project_id == project_id)
    )

    if event_id is not None:
        metric_query = metric_query.where(EventMetric.event_id == event_id)
        anomaly_query = anomaly_query.where(MetricAnomaly.event_id == event_id)
    elif event_type_id is not None:
        metric_query = metric_query.where(
            EventMetric.event_id.is_(None),
            EventMetric.event_type_id == event_type_id,
        )
        anomaly_query = anomaly_query.where(MetricAnomaly.event_type_id == event_type_id)
    else:
        return await _get_default_scan_config_id(session, project_id)

    metric_row = (
        await session.execute(metric_query.order_by(EventMetric.bucket.desc()).limit(1))
    ).first()
    anomaly_row = (
        await session.execute(anomaly_query.order_by(MetricAnomaly.bucket.desc()).limit(1))
    ).first()

    candidates = [row for row in (metric_row, anomaly_row) if row is not None]
    if not candidates:
        return await _get_default_scan_config_id(session, project_id)

    scan_config_id, _bucket = max(candidates, key=lambda row: row[1])
    return scan_config_id


async def _get_metric_rows(
    session: AsyncSession,
    *,
    scope: str,
    scan_config_id: uuid.UUID,
    scope_ref: str,
    time_from: datetime | None,
    time_to: datetime | None,
) -> list[tuple[datetime, int]]:
    if scope == SCOPE_PROJECT_TOTAL:
        query = (
            select(EventMetric.bucket, func.sum(EventMetric.count))
            .where(
                EventMetric.scan_config_id == scan_config_id,
                EventMetric.event_id.is_(None),
                EventMetric.event_type_id.is_not(None),
            )
            .group_by(EventMetric.bucket)
            .order_by(EventMetric.bucket)
        )
    elif scope == SCOPE_EVENT_TYPE:
        query = (
            select(EventMetric.bucket, EventMetric.count)
            .where(
                EventMetric.scan_config_id == scan_config_id,
                EventMetric.event_id.is_(None),
                EventMetric.event_type_id == uuid.UUID(scope_ref),
            )
            .order_by(EventMetric.bucket)
        )
    else:
        query = (
            select(EventMetric.bucket, EventMetric.count)
            .where(
                EventMetric.scan_config_id == scan_config_id,
                EventMetric.event_id == uuid.UUID(scope_ref),
            )
            .order_by(EventMetric.bucket)
        )

    if time_from is not None:
        query = query.where(EventMetric.bucket >= time_from)
    if time_to is not None:
        query = query.where(EventMetric.bucket < time_to)

    result = await session.execute(query)
    return [(bucket, int(count)) for bucket, count in result.all()]


async def _get_anomaly_rows(
    session: AsyncSession,
    *,
    scan_config_id: uuid.UUID,
    scope: str,
    scope_ref: str,
    time_from: datetime | None,
    time_to: datetime | None,
) -> list[MetricAnomaly]:
    query = (
        select(MetricAnomaly)
        .where(
            MetricAnomaly.scan_config_id == scan_config_id,
            MetricAnomaly.scope_type == scope,
            MetricAnomaly.scope_ref == scope_ref,
        )
        .order_by(MetricAnomaly.bucket)
    )
    if time_from is not None:
        query = query.where(MetricAnomaly.bucket >= time_from)
    if time_to is not None:
        query = query.where(MetricAnomaly.bucket < time_to)

    result = await session.execute(query)
    return list(result.scalars().all())


def _classify_signal_state(
    *,
    anomaly_bucket: datetime,
    latest_metric_bucket: datetime | None,
) -> str | None:
    if latest_metric_bucket is None or anomaly_bucket >= latest_metric_bucket:
        return "latest_scan"

    recent_cutoff = datetime.now(UTC)
    if anomaly_bucket.tzinfo is None:
        recent_cutoff = recent_cutoff.replace(tzinfo=None)
    recent_cutoff -= RECENT_SIGNAL_WINDOW
    if anomaly_bucket >= recent_cutoff:
        return "recent"

    return None


def _signal_from_anomaly(
    anomaly: MetricAnomaly,
    *,
    state: str,
) -> MetricSignalResponse:
    return MetricSignalResponse(
        scan_config_id=anomaly.scan_config_id,
        scope_type=anomaly.scope_type,
        scope_ref=anomaly.scope_ref,
        state=state,
        event_id=anomaly.event_id,
        event_type_id=anomaly.event_type_id,
        bucket=anomaly.bucket,
        actual_count=anomaly.actual_count,
        expected_count=anomaly.expected_count,
        stddev=anomaly.stddev,
        z_score=anomaly.z_score,
        direction=anomaly.direction,
    )


def _build_metrics_response(
    *,
    scope: str,
    scan_config_id: uuid.UUID | None,
    scope_ref: str | None,
    interval: str | None,
    metric_rows: list[tuple[datetime, int]],
    anomalies: list[MetricAnomaly],
    event_id: uuid.UUID | None = None,
    event_type_id: uuid.UUID | None = None,
) -> EventMetricsResponse:
    counts_by_bucket = {bucket: count for bucket, count in metric_rows}
    anomalies_by_bucket = {anomaly.bucket: anomaly for anomaly in anomalies}

    for anomaly in anomalies:
        counts_by_bucket.setdefault(anomaly.bucket, anomaly.actual_count)

    if interval and counts_by_bucket:
        delta = get_interval(interval).delta
        expanded = expand_series(
            [
                SeriesPoint(bucket=bucket, count=count)
                for bucket, count in sorted(counts_by_bucket.items())
            ],
            interval=delta,
            end_exclusive=max(counts_by_bucket) + delta,
        )
        data = [
            EventMetricPoint(
                bucket=point.bucket,
                count=point.count,
                expected_count=(
                    anomalies_by_bucket[point.bucket].expected_count
                    if point.bucket in anomalies_by_bucket
                    else None
                ),
                is_anomaly=point.bucket in anomalies_by_bucket,
                anomaly_direction=(
                    anomalies_by_bucket[point.bucket].direction
                    if point.bucket in anomalies_by_bucket
                    else None
                ),
                z_score=(
                    anomalies_by_bucket[point.bucket].z_score
                    if point.bucket in anomalies_by_bucket
                    else None
                ),
            )
            for point in expanded
        ]
    else:
        data = [
            EventMetricPoint(
                bucket=bucket,
                count=count,
                expected_count=(
                    anomalies_by_bucket[bucket].expected_count
                    if bucket in anomalies_by_bucket
                    else None
                ),
                is_anomaly=bucket in anomalies_by_bucket,
                anomaly_direction=(
                    anomalies_by_bucket[bucket].direction
                    if bucket in anomalies_by_bucket
                    else None
                ),
                z_score=(
                    anomalies_by_bucket[bucket].z_score
                    if bucket in anomalies_by_bucket
                    else None
                ),
            )
            for bucket, count in sorted(counts_by_bucket.items())
        ]

    latest_signal = None
    latest_metric_bucket = data[-1].bucket if data else None
    if anomalies:
        latest_anomaly = anomalies[-1]
        state = _classify_signal_state(
            anomaly_bucket=latest_anomaly.bucket,
            latest_metric_bucket=latest_metric_bucket,
        )
        if state is not None:
            latest_signal = _signal_from_anomaly(latest_anomaly, state=state)

    return EventMetricsResponse(
        scope=scope,
        scan_config_id=scan_config_id,
        event_id=event_id,
        event_type_id=event_type_id,
        interval=interval,
        latest_signal=latest_signal,
        data=data,
    )


async def get_event_metrics(
    session: AsyncSession,
    slug: str,
    event_id: uuid.UUID,
    time_from: datetime | None = None,
    time_to: datetime | None = None,
) -> EventMetricsResponse:
    project = await _resolve_project(session, slug)
    event = await _resolve_event(session, project.id, event_id)
    scan_config_id = await _resolve_scope_scan_config_id(
        session,
        project.id,
        event_id=event.id,
    )
    interval = await _get_scan_config_interval(session, scan_config_id)
    if scan_config_id is None:
        return EventMetricsResponse(
            scope=SCOPE_EVENT,
            event_id=event.id,
            interval=interval,
            data=[],
        )

    metric_rows = await _get_metric_rows(
        session,
        scope=SCOPE_EVENT,
        scan_config_id=scan_config_id,
        scope_ref=str(event.id),
        time_from=time_from,
        time_to=time_to,
    )
    anomalies = await _get_anomaly_rows(
        session,
        scan_config_id=scan_config_id,
        scope=SCOPE_EVENT,
        scope_ref=str(event.id),
        time_from=time_from,
        time_to=time_to,
    )
    return _build_metrics_response(
        scope=SCOPE_EVENT,
        scan_config_id=scan_config_id,
        scope_ref=str(event.id),
        interval=interval,
        metric_rows=metric_rows,
        anomalies=anomalies,
        event_id=event.id,
    )


async def get_events_metrics(
    session: AsyncSession,
    slug: str,
    event_type_id: uuid.UUID | None = None,
    search: str | None = None,
    implemented: bool | None = None,
    tag: str | None = None,
    reviewed: bool | None = None,
    archived: bool | None = None,
    time_from: datetime | None = None,
    time_to: datetime | None = None,
) -> EventMetricsResponse:
    project = await _resolve_project(session, slug)

    query = (
        select(EventMetric.bucket, func.sum(EventMetric.count))
        .join(Event, EventMetric.event_id == Event.id)
        .where(
            Event.project_id == project.id,
            EventMetric.event_id.is_not(None),
        )
    )

    if event_type_id:
        query = query.where(Event.event_type_id == event_type_id)
    if search:
        query = query.where(Event.name.ilike(f"%{search}%"))
    if implemented is not None:
        query = query.where(Event.implemented == implemented)
    if reviewed is not None:
        query = query.where(Event.reviewed == reviewed)
    if archived is not None:
        query = query.where(Event.archived == archived)
    if tag:
        tagged_event_ids = select(EventTag.event_id).where(EventTag.name == tag).correlate(None)
        query = query.where(Event.id.in_(tagged_event_ids))
    if time_from:
        query = query.where(EventMetric.bucket >= time_from)
    if time_to:
        query = query.where(EventMetric.bucket < time_to)

    result = await session.execute(query.group_by(EventMetric.bucket).order_by(EventMetric.bucket))
    rows = [(bucket, int(count)) for bucket, count in result.all()]

    interval = await _get_project_interval(session, project.id) if rows else None

    return EventMetricsResponse(
        scope="events_total",
        interval=interval,
        data=[EventMetricPoint(bucket=bucket, count=count) for bucket, count in rows],
    )


async def get_events_window_metrics(
    session: AsyncSession,
    slug: str,
    *,
    event_ids: list[uuid.UUID],
    time_from: datetime | None = None,
    time_to: datetime | None = None,
) -> list[EventWindowMetricsResponse]:
    if not event_ids:
        return []

    project = await _resolve_project(session, slug)
    valid_event_ids = list(
        (
            await session.execute(
                select(Event.id).where(
                    Event.project_id == project.id,
                    Event.id.in_(event_ids),
                )
            )
        ).scalars()
    )
    if not valid_event_ids:
        return []

    latest_rows = (
        await session.execute(
            select(EventMetric.event_id, EventMetric.scan_config_id, EventMetric.bucket)
            .join(ScanConfig, ScanConfig.id == EventMetric.scan_config_id)
            .where(
                ScanConfig.project_id == project.id,
                EventMetric.event_id.in_(valid_event_ids),
            )
            .order_by(EventMetric.event_id, EventMetric.bucket.desc())
        )
    ).all()

    latest_scan_by_event: dict[uuid.UUID, uuid.UUID] = {}
    for event_id, scan_config_id, _bucket in latest_rows:
        if event_id is not None and event_id not in latest_scan_by_event:
            latest_scan_by_event[event_id] = scan_config_id

    interval_by_scan: dict[uuid.UUID, str | None] = {}
    if latest_scan_by_event:
        interval_rows = (
            await session.execute(
                select(ScanConfig.id, ScanConfig.interval).where(
                    ScanConfig.id.in_(set(latest_scan_by_event.values()))
                )
            )
        ).all()
        interval_by_scan = {scan_config_id: interval for scan_config_id, interval in interval_rows}

    metric_rows_by_event: dict[uuid.UUID, list[tuple[datetime, int]]] = {
        event_id: [] for event_id in valid_event_ids
    }
    if latest_scan_by_event:
        metric_query = (
            select(
                EventMetric.event_id,
                EventMetric.scan_config_id,
                EventMetric.bucket,
                EventMetric.count,
            )
            .where(
                EventMetric.event_id.in_(valid_event_ids),
                EventMetric.scan_config_id.in_(set(latest_scan_by_event.values())),
            )
            .order_by(EventMetric.event_id, EventMetric.bucket)
        )
        if time_from is not None:
            metric_query = metric_query.where(EventMetric.bucket >= time_from)
        if time_to is not None:
            metric_query = metric_query.where(EventMetric.bucket < time_to)

        for event_id, scan_config_id, bucket, count in (await session.execute(metric_query)).all():
            if event_id is None:
                continue
            if latest_scan_by_event.get(event_id) != scan_config_id:
                continue
            metric_rows_by_event.setdefault(event_id, []).append((bucket, int(count)))

    anomaly_rows_by_event: dict[uuid.UUID, list[MetricAnomaly]] = {
        event_id: [] for event_id in valid_event_ids
    }
    if latest_scan_by_event:
        anomaly_query = (
            select(MetricAnomaly)
            .where(
                MetricAnomaly.scope_type == SCOPE_EVENT,
                MetricAnomaly.event_id.in_(valid_event_ids),
                MetricAnomaly.scan_config_id.in_(set(latest_scan_by_event.values())),
            )
            .order_by(MetricAnomaly.event_id, MetricAnomaly.bucket)
        )
        if time_from is not None:
            anomaly_query = anomaly_query.where(MetricAnomaly.bucket >= time_from)
        if time_to is not None:
            anomaly_query = anomaly_query.where(MetricAnomaly.bucket < time_to)

        for anomaly in (await session.execute(anomaly_query)).scalars():
            if anomaly.event_id is None:
                continue
            if latest_scan_by_event.get(anomaly.event_id) != anomaly.scan_config_id:
                continue
            anomaly_rows_by_event.setdefault(anomaly.event_id, []).append(anomaly)

    valid_event_ids_set = set(valid_event_ids)
    responses: list[EventWindowMetricsResponse] = []
    for event_id in event_ids:
        if event_id not in valid_event_ids_set:
            continue

        scan_config_id = latest_scan_by_event.get(event_id)
        interval = interval_by_scan.get(scan_config_id) if scan_config_id is not None else None
        metric_rows = metric_rows_by_event.get(event_id, [])
        metrics_response = _build_metrics_response(
            scope=SCOPE_EVENT,
            scan_config_id=scan_config_id,
            scope_ref=str(event_id),
            interval=interval,
            metric_rows=metric_rows,
            anomalies=anomaly_rows_by_event.get(event_id, []),
            event_id=event_id,
        )
        responses.append(
            EventWindowMetricsResponse(
                event_id=event_id,
                scan_config_id=scan_config_id,
                interval=interval,
                total_count=sum(count for _bucket, count in metric_rows),
                data=metrics_response.data,
            )
        )

    return responses


async def get_event_type_metrics(
    session: AsyncSession,
    slug: str,
    event_type_id: uuid.UUID,
    time_from: datetime | None = None,
    time_to: datetime | None = None,
) -> EventMetricsResponse:
    project = await _resolve_project(session, slug)
    event_type = await _resolve_event_type(session, project.id, event_type_id)
    scan_config_id = await _resolve_scope_scan_config_id(
        session,
        project.id,
        event_type_id=event_type.id,
    )
    interval = await _get_scan_config_interval(session, scan_config_id)
    if scan_config_id is None:
        return EventMetricsResponse(
            scope=SCOPE_EVENT_TYPE,
            event_type_id=event_type.id,
            interval=interval,
            data=[],
        )

    metric_rows = await _get_metric_rows(
        session,
        scope=SCOPE_EVENT_TYPE,
        scan_config_id=scan_config_id,
        scope_ref=str(event_type.id),
        time_from=time_from,
        time_to=time_to,
    )
    anomalies = await _get_anomaly_rows(
        session,
        scan_config_id=scan_config_id,
        scope=SCOPE_EVENT_TYPE,
        scope_ref=str(event_type.id),
        time_from=time_from,
        time_to=time_to,
    )
    return _build_metrics_response(
        scope=SCOPE_EVENT_TYPE,
        scan_config_id=scan_config_id,
        scope_ref=str(event_type.id),
        interval=interval,
        metric_rows=metric_rows,
        anomalies=anomalies,
        event_type_id=event_type.id,
    )


async def get_project_total_metrics(
    session: AsyncSession,
    slug: str,
    scan_config_id: uuid.UUID | None = None,
    time_from: datetime | None = None,
    time_to: datetime | None = None,
) -> EventMetricsResponse:
    project = await _resolve_project(session, slug)
    resolved_scan_config_id = (
        scan_config_id or await _get_default_scan_config_id(session, project.id)
    )
    if resolved_scan_config_id is None:
        return EventMetricsResponse(scope=SCOPE_PROJECT_TOTAL, data=[])

    config = await session.get(ScanConfig, resolved_scan_config_id)
    if config is None or config.project_id != project.id:
        raise HTTPException(404, "Scan config not found")

    metric_rows = await _get_metric_rows(
        session,
        scope=SCOPE_PROJECT_TOTAL,
        scan_config_id=resolved_scan_config_id,
        scope_ref=str(resolved_scan_config_id),
        time_from=time_from,
        time_to=time_to,
    )
    anomalies = await _get_anomaly_rows(
        session,
        scan_config_id=resolved_scan_config_id,
        scope=SCOPE_PROJECT_TOTAL,
        scope_ref=str(resolved_scan_config_id),
        time_from=time_from,
        time_to=time_to,
    )
    return _build_metrics_response(
        scope=SCOPE_PROJECT_TOTAL,
        scan_config_id=resolved_scan_config_id,
        scope_ref=str(resolved_scan_config_id),
        interval=config.interval,
        metric_rows=metric_rows,
        anomalies=anomalies,
    )


async def _get_latest_anomaly_rows(
    session: AsyncSession,
    *,
    project_id: uuid.UUID,
    scope_type: str,
    event_ids: list[uuid.UUID] | None = None,
) -> list[MetricAnomaly]:
    latest_subquery = (
        select(
            MetricAnomaly.scan_config_id.label("scan_config_id"),
            MetricAnomaly.scope_type.label("scope_type"),
            MetricAnomaly.scope_ref.label("scope_ref"),
            func.max(MetricAnomaly.bucket).label("bucket"),
        )
        .join(ScanConfig, ScanConfig.id == MetricAnomaly.scan_config_id)
        .where(
            ScanConfig.project_id == project_id,
            MetricAnomaly.scope_type == scope_type,
        )
        .group_by(
            MetricAnomaly.scan_config_id,
            MetricAnomaly.scope_type,
            MetricAnomaly.scope_ref,
        )
        .subquery()
    )

    query = (
        select(MetricAnomaly)
        .join(
            latest_subquery,
            (MetricAnomaly.scan_config_id == latest_subquery.c.scan_config_id)
            & (MetricAnomaly.scope_type == latest_subquery.c.scope_type)
            & (MetricAnomaly.scope_ref == latest_subquery.c.scope_ref)
            & (MetricAnomaly.bucket == latest_subquery.c.bucket),
        )
        .order_by(MetricAnomaly.bucket.desc())
    )
    if scope_type == SCOPE_EVENT and event_ids is not None:
        query = query.where(MetricAnomaly.event_id.in_(event_ids))

    result = await session.execute(query)
    return list(result.scalars().all())


async def _get_latest_metric_bucket_map(
    session: AsyncSession,
    *,
    project_id: uuid.UUID,
    scope_type: str,
    event_ids: list[uuid.UUID] | None = None,
) -> dict[tuple[uuid.UUID, str, str], datetime]:
    if scope_type == SCOPE_PROJECT_TOTAL:
        query = (
            select(EventMetric.scan_config_id, func.max(EventMetric.bucket))
            .join(ScanConfig, ScanConfig.id == EventMetric.scan_config_id)
            .where(
                ScanConfig.project_id == project_id,
                EventMetric.event_id.is_(None),
                EventMetric.event_type_id.is_not(None),
            )
            .group_by(EventMetric.scan_config_id)
        )
        rows = (await session.execute(query)).all()
        return {
            (scan_config_id, SCOPE_PROJECT_TOTAL, str(scan_config_id)): bucket
            for scan_config_id, bucket in rows
        }

    if scope_type == SCOPE_EVENT_TYPE:
        query = (
            select(
                EventMetric.scan_config_id,
                EventMetric.event_type_id,
                func.max(EventMetric.bucket),
            )
            .join(ScanConfig, ScanConfig.id == EventMetric.scan_config_id)
            .where(
                ScanConfig.project_id == project_id,
                EventMetric.event_id.is_(None),
                EventMetric.event_type_id.is_not(None),
            )
            .group_by(EventMetric.scan_config_id, EventMetric.event_type_id)
        )
        rows = (await session.execute(query)).all()
        return {
            (scan_config_id, SCOPE_EVENT_TYPE, str(event_type_id)): bucket
            for scan_config_id, event_type_id, bucket in rows
            if event_type_id is not None
        }

    query = (
        select(EventMetric.scan_config_id, EventMetric.event_id, func.max(EventMetric.bucket))
        .join(ScanConfig, ScanConfig.id == EventMetric.scan_config_id)
        .where(
            ScanConfig.project_id == project_id,
            EventMetric.event_id.is_not(None),
        )
    )
    if event_ids:
        query = query.where(EventMetric.event_id.in_(event_ids))
    query = query.group_by(EventMetric.scan_config_id, EventMetric.event_id)
    rows = (await session.execute(query)).all()
    return {
        (scan_config_id, SCOPE_EVENT, str(event_id)): bucket
        for scan_config_id, event_id, bucket in rows
        if event_id is not None
    }


async def get_active_signals(
    session: AsyncSession,
    slug: str,
    event_ids: list[uuid.UUID] | None = None,
) -> list[MetricSignalResponse]:
    project = await _resolve_project(session, slug)

    signals: list[MetricSignalResponse] = []
    for scope_type in (SCOPE_PROJECT_TOTAL, SCOPE_EVENT_TYPE, SCOPE_EVENT):
        if scope_type == SCOPE_EVENT and not event_ids:
            continue

        latest_anomalies = await _get_latest_anomaly_rows(
            session,
            project_id=project.id,
            scope_type=scope_type,
            event_ids=event_ids,
        )
        latest_metrics = await _get_latest_metric_bucket_map(
            session,
            project_id=project.id,
            scope_type=scope_type,
            event_ids=event_ids,
        )
        for anomaly in latest_anomalies:
            key = (anomaly.scan_config_id, anomaly.scope_type, anomaly.scope_ref)
            latest_metric_bucket = latest_metrics.get(key)
            state = _classify_signal_state(
                anomaly_bucket=anomaly.bucket,
                latest_metric_bucket=latest_metric_bucket,
            )
            if state is not None:
                signals.append(_signal_from_anomaly(anomaly, state=state))

    signals.sort(key=lambda signal: signal.bucket, reverse=True)
    return signals
