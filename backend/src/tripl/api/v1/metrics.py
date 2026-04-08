import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Query

from tripl.api.deps import SessionDep
from tripl.schemas.event_metric import EventMetricsResponse
from tripl.services import metrics_service

router = APIRouter(tags=["metrics"])

TimeFrom = Annotated[datetime | None, Query(alias="from")]
TimeTo = Annotated[datetime | None, Query(alias="to")]


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
):
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
):
    return await metrics_service.get_event_type_metrics(
        session, slug, event_type_id, time_from, time_to
    )
