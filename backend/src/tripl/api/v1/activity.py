from typing import Annotated

from fastapi import APIRouter, Query

from tripl.api.deps import SessionDep
from tripl.schemas.activity import ActivityItemResponse
from tripl.services import activity_service

router = APIRouter(tags=["activity"])

ActivityLimit = Annotated[int, Query(ge=1, le=100)]


@router.get("/activity", response_model=list[ActivityItemResponse])
async def list_workspace_activity(
    session: SessionDep,
    limit: ActivityLimit = 20,
) -> list[ActivityItemResponse]:
    return await activity_service.list_activity(session, limit=limit)


@router.get("/activity/projects/{slug}", response_model=list[ActivityItemResponse])
async def list_project_activity(
    session: SessionDep,
    slug: str,
    limit: ActivityLimit = 20,
) -> list[ActivityItemResponse]:
    return await activity_service.list_activity(session, slug=slug, limit=limit)
