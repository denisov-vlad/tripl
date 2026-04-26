import uuid

from fastapi import APIRouter

from tripl.api.deps import SessionDep
from tripl.models.field_definition import FieldDefinition
from tripl.schemas.field_definition import (
    FieldDefinitionCreate,
    FieldDefinitionResponse,
    FieldDefinitionUpdate,
    FieldReorder,
)
from tripl.services import field_service

router = APIRouter(prefix="/projects/{slug}/event-types/{event_type_id}/fields", tags=["fields"])


@router.get("", response_model=list[FieldDefinitionResponse])
async def list_fields(
    session: SessionDep, slug: str, event_type_id: uuid.UUID
) -> list[FieldDefinition]:
    return await field_service.list_fields(session, slug, event_type_id)


@router.post("", response_model=FieldDefinitionResponse, status_code=201)
async def create_field(
    session: SessionDep, slug: str, event_type_id: uuid.UUID, data: FieldDefinitionCreate
) -> FieldDefinition:
    return await field_service.create_field(session, slug, event_type_id, data)


@router.patch("/reorder", response_model=list[FieldDefinitionResponse])
async def reorder_fields(
    session: SessionDep, slug: str, event_type_id: uuid.UUID, data: FieldReorder
) -> list[FieldDefinition]:
    return await field_service.reorder_fields(session, slug, event_type_id, data)


@router.patch("/{field_id}", response_model=FieldDefinitionResponse)
async def update_field(
    session: SessionDep,
    slug: str,
    event_type_id: uuid.UUID,
    field_id: uuid.UUID,
    data: FieldDefinitionUpdate,
) -> FieldDefinition:
    return await field_service.update_field(session, slug, event_type_id, field_id, data)


@router.delete("/{field_id}", status_code=204)
async def delete_field(
    session: SessionDep, slug: str, event_type_id: uuid.UUID, field_id: uuid.UUID
) -> None:
    await field_service.delete_field(session, slug, event_type_id, field_id)
