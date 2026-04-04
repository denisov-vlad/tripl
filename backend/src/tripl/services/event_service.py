import uuid

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from tripl.models.event import Event
from tripl.models.event_field_value import EventFieldValue
from tripl.models.event_meta_value import EventMetaValue
from tripl.models.event_tag import EventTag
from tripl.models.field_definition import FieldDefinition
from tripl.schemas.event import EventCreate, EventUpdate
from tripl.services.project_service import get_project_id_by_slug


async def _validate_field_values(
    session: AsyncSession, event_type_id: uuid.UUID, field_values: list
) -> None:
    result = await session.execute(
        select(FieldDefinition).where(FieldDefinition.event_type_id == event_type_id)
    )
    field_defs = {fd.id: fd for fd in result.scalars().all()}

    provided_ids = {fv.field_definition_id for fv in field_values}
    for fd_id, fd in field_defs.items():
        if fd.is_required and fd_id not in provided_ids:
            raise HTTPException(status_code=422, detail=f"Required field '{fd.name}' is missing")
    for fv in field_values:
        if fv.field_definition_id not in field_defs:
            raise HTTPException(
                status_code=422, detail=f"Field definition {fv.field_definition_id} not found"
            )


async def list_events(
    session: AsyncSession,
    slug: str,
    event_type_id: uuid.UUID | None = None,
    search: str | None = None,
    implemented: bool | None = None,
    tag: str | None = None,
    offset: int = 0,
    limit: int = 50,
) -> tuple[list[Event], int]:
    project_id = await get_project_id_by_slug(session, slug)
    query = select(Event).where(Event.project_id == project_id)
    count_query = select(func.count(Event.id)).where(Event.project_id == project_id)

    if event_type_id:
        query = query.where(Event.event_type_id == event_type_id)
        count_query = count_query.where(Event.event_type_id == event_type_id)
    if search:
        query = query.where(Event.name.ilike(f"%{search}%"))
        count_query = count_query.where(Event.name.ilike(f"%{search}%"))
    if implemented is not None:
        query = query.where(Event.implemented == implemented)
        count_query = count_query.where(Event.implemented == implemented)
    if tag:
        tag_filter = select(EventTag.event_id).where(EventTag.name == tag).correlate(None)
        query = query.where(Event.id.in_(tag_filter))
        count_query = count_query.where(Event.id.in_(tag_filter))

    total = (await session.execute(count_query)).scalar() or 0
    result = await session.execute(
        query.order_by(Event.created_at.desc()).offset(offset).limit(limit)
    )
    return list(result.scalars().all()), total


async def list_tags(session: AsyncSession, slug: str) -> list[str]:
    project_id = await get_project_id_by_slug(session, slug)
    result = await session.execute(
        select(EventTag.name)
        .join(Event, EventTag.event_id == Event.id)
        .where(Event.project_id == project_id)
        .distinct()
        .order_by(EventTag.name)
    )
    return list(result.scalars().all())


async def get_event(session: AsyncSession, slug: str, event_id: uuid.UUID) -> Event:
    project_id = await get_project_id_by_slug(session, slug)
    result = await session.execute(
        select(Event).where(Event.id == event_id, Event.project_id == project_id)
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


async def create_event(session: AsyncSession, slug: str, data: EventCreate) -> Event:
    project_id = await get_project_id_by_slug(session, slug)
    await _validate_field_values(session, data.event_type_id, data.field_values)

    event = Event(
        project_id=project_id,
        event_type_id=data.event_type_id,
        name=data.name,
        description=data.description,
        implemented=data.implemented,
    )
    session.add(event)
    await session.flush()

    for fv in data.field_values:
        session.add(
            EventFieldValue(
                event_id=event.id,
                field_definition_id=fv.field_definition_id,
                value=fv.value,
            )
        )
    for mv in data.meta_values:
        session.add(
            EventMetaValue(
                event_id=event.id,
                meta_field_definition_id=mv.meta_field_definition_id,
                value=mv.value,
            )
        )
    for tag_name in data.tags:
        session.add(EventTag(event_id=event.id, name=tag_name))

    await session.commit()
    await session.refresh(event)
    return event


async def update_event(
    session: AsyncSession, slug: str, event_id: uuid.UUID, data: EventUpdate
) -> Event:
    event = await get_event(session, slug, event_id)
    update_data = data.model_dump(exclude_unset=True)

    if "name" in update_data:
        event.name = update_data["name"]
    if "description" in update_data:
        event.description = update_data["description"]
    if "implemented" in update_data:
        event.implemented = update_data["implemented"]

    if data.tags is not None:
        for t in list(event.tags):
            await session.delete(t)
        await session.flush()
        for tag_name in data.tags:
            session.add(EventTag(event_id=event.id, name=tag_name))

    if data.field_values is not None:
        await _validate_field_values(session, event.event_type_id, data.field_values)
        # Remove existing field values
        for fv in list(event.field_values):
            await session.delete(fv)
        await session.flush()
        for fv in data.field_values:
            session.add(
                EventFieldValue(
                    event_id=event.id,
                    field_definition_id=fv.field_definition_id,
                    value=fv.value,
                )
            )

    if data.meta_values is not None:
        for mv in list(event.meta_values):
            await session.delete(mv)
        await session.flush()
        for mv in data.meta_values:
            session.add(
                EventMetaValue(
                    event_id=event.id,
                    meta_field_definition_id=mv.meta_field_definition_id,
                    value=mv.value,
                )
            )

    await session.commit()
    await session.refresh(event)
    return event


async def delete_event(session: AsyncSession, slug: str, event_id: uuid.UUID) -> None:
    event = await get_event(session, slug, event_id)
    await session.delete(event)
    await session.commit()


async def bulk_create_events(
    session: AsyncSession, slug: str, events_data: list[EventCreate]
) -> list[Event]:
    results = []
    for data in events_data:
        event = await create_event(session, slug, data)
        results.append(event)
    return results
