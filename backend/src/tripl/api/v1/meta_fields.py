import uuid

from fastapi import APIRouter

from tripl.api.deps import SessionDep
from tripl.schemas.meta_field import MetaFieldCreate, MetaFieldResponse, MetaFieldUpdate
from tripl.services import meta_field_service

router = APIRouter(prefix="/projects/{slug}/meta-fields", tags=["meta-fields"])


@router.get("", response_model=list[MetaFieldResponse])
async def list_meta_fields(session: SessionDep, slug: str):
    return await meta_field_service.list_meta_fields(session, slug)


@router.post("", response_model=MetaFieldResponse, status_code=201)
async def create_meta_field(session: SessionDep, slug: str, data: MetaFieldCreate):
    return await meta_field_service.create_meta_field(session, slug, data)


@router.patch("/{meta_field_id}", response_model=MetaFieldResponse)
async def update_meta_field(
    session: SessionDep, slug: str, meta_field_id: uuid.UUID, data: MetaFieldUpdate
):
    return await meta_field_service.update_meta_field(session, slug, meta_field_id, data)


@router.delete("/{meta_field_id}", status_code=204)
async def delete_meta_field(session: SessionDep, slug: str, meta_field_id: uuid.UUID):
    await meta_field_service.delete_meta_field(session, slug, meta_field_id)
