from fastapi import APIRouter

from tripl.api.deps import SessionDep
from tripl.models.project_anomaly_settings import ProjectAnomalySettings
from tripl.schemas.project_anomaly_settings import (
    ProjectAnomalySettingsResponse,
    ProjectAnomalySettingsUpdate,
)
from tripl.services import project_anomaly_settings_service

router = APIRouter(
    prefix="/projects/{slug}/anomaly-settings",
    tags=["anomaly-settings"],
)


@router.get("", response_model=ProjectAnomalySettingsResponse)
async def get_project_anomaly_settings(session: SessionDep, slug: str) -> ProjectAnomalySettings:
    return await project_anomaly_settings_service.get_project_anomaly_settings(session, slug)


@router.patch("", response_model=ProjectAnomalySettingsResponse)
async def update_project_anomaly_settings(
    session: SessionDep,
    slug: str,
    data: ProjectAnomalySettingsUpdate,
) -> ProjectAnomalySettings:
    return await project_anomaly_settings_service.update_project_anomaly_settings(
        session,
        slug,
        data,
    )
