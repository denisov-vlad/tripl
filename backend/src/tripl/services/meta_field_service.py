import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from tripl.models.meta_field_definition import MetaFieldDefinition
from tripl.schemas.meta_field import MetaFieldCreate, MetaFieldUpdate
from tripl.services.project_service import get_project_id_by_slug


async def list_meta_fields(session: AsyncSession, slug: str) -> list[MetaFieldDefinition]:
    project_id = await get_project_id_by_slug(session, slug)
    result = await session.execute(
        select(MetaFieldDefinition)
        .where(MetaFieldDefinition.project_id == project_id)
        .order_by(MetaFieldDefinition.order)
    )
    return list(result.scalars().all())


async def create_meta_field(
    session: AsyncSession, slug: str, data: MetaFieldCreate
) -> MetaFieldDefinition:
    project_id = await get_project_id_by_slug(session, slug)
    existing = await session.execute(
        select(MetaFieldDefinition).where(
            MetaFieldDefinition.project_id == project_id,
            MetaFieldDefinition.name == data.name,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Meta field with this name already exists")
    mf = MetaFieldDefinition(**data.model_dump(), project_id=project_id)
    session.add(mf)
    await session.commit()
    await session.refresh(mf)
    return mf


async def update_meta_field(
    session: AsyncSession, slug: str, meta_field_id: uuid.UUID, data: MetaFieldUpdate
) -> MetaFieldDefinition:
    project_id = await get_project_id_by_slug(session, slug)
    result = await session.execute(
        select(MetaFieldDefinition).where(
            MetaFieldDefinition.id == meta_field_id,
            MetaFieldDefinition.project_id == project_id,
        )
    )
    mf = result.scalar_one_or_none()
    if not mf:
        raise HTTPException(status_code=404, detail="Meta field not found")
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(mf, key, value)
    await session.commit()
    await session.refresh(mf)
    return mf


async def delete_meta_field(session: AsyncSession, slug: str, meta_field_id: uuid.UUID) -> None:
    project_id = await get_project_id_by_slug(session, slug)
    result = await session.execute(
        select(MetaFieldDefinition).where(
            MetaFieldDefinition.id == meta_field_id,
            MetaFieldDefinition.project_id == project_id,
        )
    )
    mf = result.scalar_one_or_none()
    if not mf:
        raise HTTPException(status_code=404, detail="Meta field not found")
    await session.delete(mf)
    await session.commit()
