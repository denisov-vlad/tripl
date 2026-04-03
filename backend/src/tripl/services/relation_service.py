import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from tripl.models.event_type_relation import EventTypeRelation
from tripl.schemas.relation import RelationCreate
from tripl.services.project_service import get_project_id_by_slug


async def list_relations(session: AsyncSession, slug: str) -> list[EventTypeRelation]:
    project_id = await get_project_id_by_slug(session, slug)
    result = await session.execute(
        select(EventTypeRelation).where(EventTypeRelation.project_id == project_id)
    )
    return list(result.scalars().all())


async def create_relation(
    session: AsyncSession, slug: str, data: RelationCreate
) -> EventTypeRelation:
    project_id = await get_project_id_by_slug(session, slug)
    relation = EventTypeRelation(**data.model_dump(), project_id=project_id)
    session.add(relation)
    await session.commit()
    await session.refresh(relation)
    return relation


async def delete_relation(session: AsyncSession, slug: str, relation_id: uuid.UUID) -> None:
    project_id = await get_project_id_by_slug(session, slug)
    result = await session.execute(
        select(EventTypeRelation).where(
            EventTypeRelation.id == relation_id,
            EventTypeRelation.project_id == project_id,
        )
    )
    relation = result.scalar_one_or_none()
    if not relation:
        raise HTTPException(status_code=404, detail="Relation not found")
    await session.delete(relation)
    await session.commit()
