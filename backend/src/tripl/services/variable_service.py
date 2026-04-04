import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from tripl.models.variable import Variable
from tripl.schemas.variable import VariableCreate, VariableUpdate
from tripl.services.project_service import get_project_id_by_slug


async def list_variables(session: AsyncSession, slug: str) -> list[Variable]:
    project_id = await get_project_id_by_slug(session, slug)
    result = await session.execute(
        select(Variable)
        .where(Variable.project_id == project_id)
        .order_by(Variable.name)
    )
    return list(result.scalars().all())


async def create_variable(
    session: AsyncSession, slug: str, data: VariableCreate
) -> Variable:
    project_id = await get_project_id_by_slug(session, slug)
    existing = await session.execute(
        select(Variable).where(
            Variable.project_id == project_id,
            Variable.name == data.name,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Variable with this name already exists")
    var = Variable(**data.model_dump(), project_id=project_id)
    session.add(var)
    await session.commit()
    await session.refresh(var)
    return var


async def update_variable(
    session: AsyncSession, slug: str, variable_id: uuid.UUID, data: VariableUpdate
) -> Variable:
    project_id = await get_project_id_by_slug(session, slug)
    result = await session.execute(
        select(Variable).where(
            Variable.id == variable_id,
            Variable.project_id == project_id,
        )
    )
    var = result.scalar_one_or_none()
    if not var:
        raise HTTPException(status_code=404, detail="Variable not found")
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(var, key, value)
    await session.commit()
    await session.refresh(var)
    return var


async def delete_variable(session: AsyncSession, slug: str, variable_id: uuid.UUID) -> None:
    project_id = await get_project_id_by_slug(session, slug)
    result = await session.execute(
        select(Variable).where(
            Variable.id == variable_id,
            Variable.project_id == project_id,
        )
    )
    var = result.scalar_one_or_none()
    if not var:
        raise HTTPException(status_code=404, detail="Variable not found")
    await session.delete(var)
    await session.commit()
