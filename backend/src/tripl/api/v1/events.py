import uuid

from fastapi import APIRouter, Query

from tripl.api.deps import SessionDep
from tripl.schemas.event import EventCreate, EventListResponse, EventResponse, EventUpdate
from tripl.services import event_service

router = APIRouter(prefix="/projects/{slug}/events", tags=["events"])


@router.get("", response_model=EventListResponse)
async def list_events(
    session: SessionDep,
    slug: str,
    event_type_id: uuid.UUID | None = None,
    search: str | None = None,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    items, total = await event_service.list_events(
        session, slug, event_type_id, search, offset, limit
    )
    return EventListResponse(items=items, total=total)


@router.post("", response_model=EventResponse, status_code=201)
async def create_event(session: SessionDep, slug: str, data: EventCreate):
    return await event_service.create_event(session, slug, data)


@router.post("/bulk", response_model=list[EventResponse], status_code=201)
async def bulk_create_events(session: SessionDep, slug: str, data: list[EventCreate]):
    return await event_service.bulk_create_events(session, slug, data)


@router.get("/{event_id}", response_model=EventResponse)
async def get_event(session: SessionDep, slug: str, event_id: uuid.UUID):
    return await event_service.get_event(session, slug, event_id)


@router.patch("/{event_id}", response_model=EventResponse)
async def update_event(session: SessionDep, slug: str, event_id: uuid.UUID, data: EventUpdate):
    return await event_service.update_event(session, slug, event_id, data)


@router.delete("/{event_id}", status_code=204)
async def delete_event(session: SessionDep, slug: str, event_id: uuid.UUID):
    await event_service.delete_event(session, slug, event_id)
