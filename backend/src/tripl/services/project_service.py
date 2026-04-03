import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from tripl.models.project import Project
from tripl.schemas.project import ProjectCreate, ProjectUpdate


async def list_projects(session: AsyncSession) -> list[Project]:
    result = await session.execute(select(Project).order_by(Project.created_at.desc()))
    return list(result.scalars().all())


async def get_project_by_slug(session: AsyncSession, slug: str) -> Project:
    result = await session.execute(select(Project).where(Project.slug == slug))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


async def create_project(session: AsyncSession, data: ProjectCreate) -> Project:
    existing = await session.execute(select(Project).where(Project.slug == data.slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Project with this slug already exists")
    project = Project(**data.model_dump())
    session.add(project)
    await session.commit()
    await session.refresh(project)
    return project


async def update_project(session: AsyncSession, slug: str, data: ProjectUpdate) -> Project:
    project = await get_project_by_slug(session, slug)
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(project, key, value)
    await session.commit()
    await session.refresh(project)
    return project


async def delete_project(session: AsyncSession, slug: str) -> None:
    project = await get_project_by_slug(session, slug)
    await session.delete(project)
    await session.commit()


async def get_project_id_by_slug(session: AsyncSession, slug: str) -> uuid.UUID:
    project = await get_project_by_slug(session, slug)
    return project.id
