import uuid

from fastapi import APIRouter

from tripl.api.deps import SessionDep
from tripl.schemas.scan_config import (
    ScanConfigCreate,
    ScanConfigPreviewRequest,
    ScanConfigPreviewResponse,
    ScanConfigResponse,
    ScanConfigUpdate,
)
from tripl.schemas.scan_job import ScanJobResponse
from tripl.services import scan_service

router = APIRouter(
    prefix="/projects/{slug}/scans",
    tags=["scans"],
)


@router.get("", response_model=list[ScanConfigResponse])
async def list_scan_configs(session: SessionDep, slug: str):
    return await scan_service.list_scan_configs(session, slug)


@router.post("", response_model=ScanConfigResponse, status_code=201)
async def create_scan_config(
    session: SessionDep, slug: str, data: ScanConfigCreate
):
    return await scan_service.create_scan_config(session, slug, data)


@router.post("/preview", response_model=ScanConfigPreviewResponse)
async def preview_scan_config(
    session: SessionDep,
    slug: str,
    data: ScanConfigPreviewRequest,
):
    return await scan_service.preview_scan_config(session, slug, data)


@router.get("/{scan_id}", response_model=ScanConfigResponse)
async def get_scan_config(session: SessionDep, slug: str, scan_id: uuid.UUID):
    return await scan_service.get_scan_config(session, slug, scan_id)


@router.patch("/{scan_id}", response_model=ScanConfigResponse)
async def update_scan_config(
    session: SessionDep,
    slug: str,
    scan_id: uuid.UUID,
    data: ScanConfigUpdate,
):
    return await scan_service.update_scan_config(session, slug, scan_id, data)


@router.delete("/{scan_id}", status_code=204)
async def delete_scan_config(session: SessionDep, slug: str, scan_id: uuid.UUID):
    await scan_service.delete_scan_config(session, slug, scan_id)


@router.post("/{scan_id}/run", response_model=ScanJobResponse, status_code=201)
async def run_scan(session: SessionDep, slug: str, scan_id: uuid.UUID):
    return await scan_service.trigger_scan(session, slug, scan_id)


@router.get("/{scan_id}/jobs", response_model=list[ScanJobResponse])
async def list_scan_jobs(session: SessionDep, slug: str, scan_id: uuid.UUID):
    return await scan_service.list_scan_jobs(session, slug, scan_id)


@router.get("/{scan_id}/jobs/{job_id}", response_model=ScanJobResponse)
async def get_scan_job(
    session: SessionDep,
    slug: str,
    scan_id: uuid.UUID,
    job_id: uuid.UUID,
):
    return await scan_service.get_scan_job(session, slug, scan_id, job_id)
