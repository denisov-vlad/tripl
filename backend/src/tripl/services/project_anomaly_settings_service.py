import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from tripl.models.project import Project
from tripl.models.project_anomaly_settings import ProjectAnomalySettings
from tripl.schemas.project_anomaly_settings import ProjectAnomalySettingsUpdate


async def _get_project(session: AsyncSession, slug: str) -> Project:
    project = await session.scalar(select(Project).where(Project.slug == slug))
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


async def _ensure_settings(
    session: AsyncSession,
    project_id: uuid.UUID,
) -> ProjectAnomalySettings:
    settings = await session.scalar(
        select(ProjectAnomalySettings).where(ProjectAnomalySettings.project_id == project_id)
    )
    if settings is not None:
        return settings

    settings = ProjectAnomalySettings(project_id=project_id)
    session.add(settings)
    await session.commit()
    await session.refresh(settings)
    return settings


async def get_project_anomaly_settings(
    session: AsyncSession,
    slug: str,
) -> ProjectAnomalySettings:
    project = await _get_project(session, slug)
    return await _ensure_settings(session, project.id)


async def update_project_anomaly_settings(
    session: AsyncSession,
    slug: str,
    data: ProjectAnomalySettingsUpdate,
) -> ProjectAnomalySettings:
    project = await _get_project(session, slug)
    settings = await _ensure_settings(session, project.id)
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(settings, key, value)
    await session.commit()
    await session.refresh(settings)
    return settings
