import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from tripl.models.event_type import EventType
from tripl.schemas.event_type import EventTypeCreate, EventTypeUpdate
from tripl.services.project_service import get_project_id_by_slug


async def list_event_types(session: AsyncSession, slug: str) -> list[EventType]:
    project_id = await get_project_id_by_slug(session, slug)
    result = await session.execute(
        select(EventType)
        .where(EventType.project_id == project_id)
        .order_by(EventType.order, EventType.created_at)
    )
    return list(result.scalars().all())


async def get_event_type(session: AsyncSession, slug: str, event_type_id: uuid.UUID) -> EventType:
    project_id = await get_project_id_by_slug(session, slug)
    result = await session.execute(
        select(EventType).where(EventType.id == event_type_id, EventType.project_id == project_id)
    )
    et = result.scalar_one_or_none()
    if not et:
        raise HTTPException(status_code=404, detail="Event type not found")
    return et


async def create_event_type(session: AsyncSession, slug: str, data: EventTypeCreate) -> EventType:
    project_id = await get_project_id_by_slug(session, slug)
    existing = await session.execute(
        select(EventType).where(EventType.project_id == project_id, EventType.name == data.name)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409, detail="Event type with this name already exists in project"
        )
    et = EventType(**data.model_dump(), project_id=project_id)
    session.add(et)
    await session.commit()
    await session.refresh(et)
    return et


async def update_event_type(
    session: AsyncSession, slug: str, event_type_id: uuid.UUID, data: EventTypeUpdate
) -> EventType:
    et = await get_event_type(session, slug, event_type_id)
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(et, key, value)
    await session.commit()
    await session.refresh(et)
    return et


async def delete_event_type(session: AsyncSession, slug: str, event_type_id: uuid.UUID) -> None:
    et = await get_event_type(session, slug, event_type_id)
    await session.delete(et)
    await session.commit()
