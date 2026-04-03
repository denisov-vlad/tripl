from fastapi import APIRouter

from tripl.api.deps import SessionDep
from tripl.schemas.project import ProjectCreate, ProjectResponse, ProjectUpdate
from tripl.services import project_service

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[ProjectResponse])
async def list_projects(session: SessionDep):
    return await project_service.list_projects(session)


@router.post("", response_model=ProjectResponse, status_code=201)
async def create_project(session: SessionDep, data: ProjectCreate):
    return await project_service.create_project(session, data)


@router.get("/{slug}", response_model=ProjectResponse)
async def get_project(session: SessionDep, slug: str):
    return await project_service.get_project_by_slug(session, slug)


@router.patch("/{slug}", response_model=ProjectResponse)
async def update_project(session: SessionDep, slug: str, data: ProjectUpdate):
    return await project_service.update_project(session, slug, data)


@router.delete("/{slug}", status_code=204)
async def delete_project(session: SessionDep, slug: str):
    await project_service.delete_project(session, slug)
