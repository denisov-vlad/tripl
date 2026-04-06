import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from tripl.models.data_source import DataSource
from tripl.models.project import Project
from tripl.models.scan_config import ScanConfig
from tripl.models.scan_job import ScanJob, ScanJobStatus
from tripl.schemas.scan_config import ScanConfigCreate, ScanConfigUpdate


async def _get_project_id(session: AsyncSession, slug: str) -> uuid.UUID:
    result = await session.execute(select(Project.id).where(Project.slug == slug))
    project_id = result.scalar_one_or_none()
    if project_id is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project_id


async def _verify_data_source(session: AsyncSession, ds_id: uuid.UUID) -> DataSource:
    result = await session.execute(
        select(DataSource).where(DataSource.id == ds_id)
    )
    ds = result.scalar_one_or_none()
    if ds is None:
        raise HTTPException(status_code=404, detail="Data source not found")
    return ds


async def list_scan_configs(session: AsyncSession, slug: str) -> list[ScanConfig]:
    project_id = await _get_project_id(session, slug)
    result = await session.execute(
        select(ScanConfig)
        .where(ScanConfig.project_id == project_id)
        .order_by(ScanConfig.created_at.desc())
    )
    return list(result.scalars().all())


async def get_scan_config(
    session: AsyncSession, slug: str, scan_id: uuid.UUID
) -> ScanConfig:
    project_id = await _get_project_id(session, slug)
    result = await session.execute(
        select(ScanConfig).where(ScanConfig.id == scan_id, ScanConfig.project_id == project_id)
    )
    config = result.scalar_one_or_none()
    if config is None:
        raise HTTPException(status_code=404, detail="Scan config not found")
    return config


async def create_scan_config(
    session: AsyncSession, slug: str, data: ScanConfigCreate
) -> ScanConfig:
    project_id = await _get_project_id(session, slug)
    await _verify_data_source(session, data.data_source_id)

    existing = await session.execute(
        select(ScanConfig).where(
            ScanConfig.project_id == project_id,
            ScanConfig.data_source_id == data.data_source_id,
            ScanConfig.name == data.name,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Scan config with this name already exists")

    config = ScanConfig(
        project_id=project_id,
        **data.model_dump(),
    )
    session.add(config)
    await session.commit()
    await session.refresh(config)
    return config


async def update_scan_config(
    session: AsyncSession,
    slug: str,
    scan_id: uuid.UUID,
    data: ScanConfigUpdate,
) -> ScanConfig:
    config = await get_scan_config(session, slug, scan_id)
    update_dict = data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(config, key, value)
    await session.commit()
    await session.refresh(config)
    return config


async def delete_scan_config(
    session: AsyncSession, slug: str, scan_id: uuid.UUID
) -> None:
    config = await get_scan_config(session, slug, scan_id)
    await session.delete(config)
    await session.commit()


async def trigger_scan(
    session: AsyncSession, slug: str, scan_id: uuid.UUID
) -> ScanJob:
    """Create a ScanJob and dispatch the Celery task."""
    config = await get_scan_config(session, slug, scan_id)

    job = ScanJob(
        scan_config_id=config.id,
        status=ScanJobStatus.pending.value,
    )
    session.add(job)
    await session.commit()
    await session.refresh(job)

    # Import here to avoid circular imports at module level
    from tripl.worker.tasks.scan import run_scan

    run_scan.delay(str(config.id), str(job.id))
    return job


async def list_scan_jobs(
    session: AsyncSession, slug: str, scan_id: uuid.UUID
) -> list[ScanJob]:
    await get_scan_config(session, slug, scan_id)
    result = await session.execute(
        select(ScanJob).where(ScanJob.scan_config_id == scan_id).order_by(ScanJob.created_at.desc())
    )
    return list(result.scalars().all())


async def get_scan_job(
    session: AsyncSession,
    slug: str,
    scan_id: uuid.UUID,
    job_id: uuid.UUID,
) -> ScanJob:
    await get_scan_config(session, slug, scan_id)
    result = await session.execute(
        select(ScanJob).where(ScanJob.id == job_id, ScanJob.scan_config_id == scan_id)
    )
    job = result.scalar_one_or_none()
    if job is None:
        raise HTTPException(status_code=404, detail="Scan job not found")
    return job
