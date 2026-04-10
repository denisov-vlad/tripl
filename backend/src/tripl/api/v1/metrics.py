import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Query

from tripl.api.deps import SessionDep
from tripl.schemas.event_metric import EventMetricsResponse, MetricSignalResponse
from tripl.services import metrics_service

router = APIRouter(tags=["metrics"])

TimeFrom = Annotated[datetime | None, Query(alias="from")]
TimeTo = Annotated[datetime | None, Query(alias="to")]
EventIds = Annotated[list[uuid.UUID] | None, Query(alias="event_id")]


@router.get(
    "/projects/{slug}/events-metrics",
    response_model=EventMetricsResponse,
)
async def get_events_metrics(
    session: SessionDep,
    slug: str,
    event_type_id: uuid.UUID | None = None,
    search: str | None = None,
    implemented: bool | None = None,
    tag: str | None = None,
    reviewed: bool | None = None,
    archived: bool | None = None,
    time_from: TimeFrom = None,
    time_to: TimeTo = None,
) -> EventMetricsResponse:
    return await metrics_service.get_events_metrics(
        session,
        slug,
        event_type_id=event_type_id,
        search=search,
        implemented=implemented,
        tag=tag,
        reviewed=reviewed,
        archived=archived,
        time_from=time_from,
        time_to=time_to,
    )


@router.get(
    "/projects/{slug}/metrics/total",
    response_model=EventMetricsResponse,
)
async def get_project_total_metrics(
    session: SessionDep,
    slug: str,
    scan_config_id: uuid.UUID | None = None,
    time_from: TimeFrom = None,
    time_to: TimeTo = None,
) -> EventMetricsResponse:
    return await metrics_service.get_project_total_metrics(
        session,
        slug,
        scan_config_id=scan_config_id,
        time_from=time_from,
        time_to=time_to,
    )


@router.get(
    "/projects/{slug}/events/{event_id}/metrics",
    response_model=EventMetricsResponse,
)
async def get_event_metrics(
    session: SessionDep,
    slug: str,
    event_id: uuid.UUID,
    time_from: TimeFrom = None,
    time_to: TimeTo = None,
) -> EventMetricsResponse:
    return await metrics_service.get_event_metrics(session, slug, event_id, time_from, time_to)


@router.get(
    "/projects/{slug}/event-types/{event_type_id}/metrics",
    response_model=EventMetricsResponse,
)
async def get_event_type_metrics(
    session: SessionDep,
    slug: str,
    event_type_id: uuid.UUID,
    time_from: TimeFrom = None,
    time_to: TimeTo = None,
) -> EventMetricsResponse:
    return await metrics_service.get_event_type_metrics(
        session, slug, event_type_id, time_from, time_to
    )


@router.get(
    "/projects/{slug}/anomalies/signals",
    response_model=list[MetricSignalResponse],
)
async def get_active_signals(
    session: SessionDep,
    slug: str,
    event_ids: EventIds = None,
) -> list[MetricSignalResponse]:
    return await metrics_service.get_active_signals(session, slug, event_ids=event_ids)
