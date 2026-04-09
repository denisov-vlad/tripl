"""Service for querying event metrics from PostgreSQL."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from tripl.models.event import Event
from tripl.models.event_metric import EventMetric
from tripl.models.event_tag import EventTag
from tripl.models.project import Project
from tripl.models.scan_config import ScanConfig
from tripl.schemas.event_metric import EventMetricPoint, EventMetricsResponse


async def _resolve_project(session: AsyncSession, slug: str) -> Project:
    result = await session.execute(select(Project).where(Project.slug == slug))
    project = result.scalar_one_or_none()
    if project is None:
        from fastapi import HTTPException

        raise HTTPException(404, f"Project '{slug}' not found")
    return project


async def _get_project_interval(session: AsyncSession, project_id: uuid.UUID) -> str | None:
    result = await session.execute(
        select(ScanConfig.interval).where(
            ScanConfig.project_id == project_id,
            ScanConfig.interval.isnot(None),
        ).limit(1)
    )
    return result.scalar_one_or_none()


async def get_event_metrics(
    session: AsyncSession,
    slug: str,
    event_id: uuid.UUID,
    time_from: datetime | None = None,
    time_to: datetime | None = None,
) -> EventMetricsResponse:
    project = await _resolve_project(session, slug)

    # Verify event belongs to this project
    event = await session.get(Event, event_id)
    if event is None or event.project_id != project.id:
        from fastapi import HTTPException

        raise HTTPException(404, "Event not found")

    query = (
        select(EventMetric.bucket, EventMetric.count)
        .where(EventMetric.event_id == event_id)
        .order_by(EventMetric.bucket)
    )
    if time_from:
        query = query.where(EventMetric.bucket >= time_from)
    if time_to:
        query = query.where(EventMetric.bucket < time_to)

    result = await session.execute(query)
    rows = result.all()

    # Find interval from scan config
    interval = await _get_project_interval(session, project.id) if rows else None

    return EventMetricsResponse(
        event_id=event_id,
        interval=interval,
        data=[EventMetricPoint(bucket=r[0], count=r[1]) for r in rows],
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

    result = await session.execute(
        query.group_by(EventMetric.bucket).order_by(EventMetric.bucket)
    )
    rows = result.all()

    interval = await _get_project_interval(session, project.id) if rows else None

    return EventMetricsResponse(
        interval=interval,
        data=[EventMetricPoint(bucket=r[0], count=r[1]) for r in rows],
    )


async def get_event_type_metrics(
    session: AsyncSession,
    slug: str,
    event_type_id: uuid.UUID,
    time_from: datetime | None = None,
    time_to: datetime | None = None,
) -> EventMetricsResponse:
    project = await _resolve_project(session, slug)

    query = (
        select(EventMetric.bucket, EventMetric.count)
        .where(
            EventMetric.event_type_id == event_type_id,
            EventMetric.event_id.is_(None),  # type-level aggregates only
        )
        .order_by(EventMetric.bucket)
    )
    if time_from:
        query = query.where(EventMetric.bucket >= time_from)
    if time_to:
        query = query.where(EventMetric.bucket < time_to)

    result = await session.execute(query)
    rows = result.all()

    interval = await _get_project_interval(session, project.id)

    return EventMetricsResponse(
        event_type_id=event_type_id,
        interval=interval,
        data=[EventMetricPoint(bucket=r[0], count=r[1]) for r in rows],
    )
