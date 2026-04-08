"""Service for querying event metrics from PostgreSQL."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from tripl.models.event import Event
from tripl.models.event_metric import EventMetric
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
    interval = None
    if rows:
        sc_result = await session.execute(
            select(ScanConfig.interval).where(
                ScanConfig.project_id == project.id,
                ScanConfig.interval.isnot(None),
            ).limit(1)
        )
        interval = sc_result.scalar_one_or_none()

    return EventMetricsResponse(
        event_id=event_id,
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

    interval = None
    sc_result = await session.execute(
        select(ScanConfig.interval).where(
            ScanConfig.project_id == project.id,
            ScanConfig.interval.isnot(None),
        ).limit(1)
    )
    interval = sc_result.scalar_one_or_none()

    return EventMetricsResponse(
        event_type_id=event_type_id,
        interval=interval,
        data=[EventMetricPoint(bucket=r[0], count=r[1]) for r in rows],
    )
