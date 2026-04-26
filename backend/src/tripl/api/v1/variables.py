import uuid

from fastapi import APIRouter

from tripl.api.deps import SessionDep
from tripl.models.variable import Variable
from tripl.schemas.variable import VariableCreate, VariableResponse, VariableUpdate
from tripl.services import variable_service

router = APIRouter(prefix="/projects/{slug}/variables", tags=["variables"])


@router.get("", response_model=list[VariableResponse])
async def list_variables(session: SessionDep, slug: str) -> list[Variable]:
    return await variable_service.list_variables(session, slug)


@router.post("", response_model=VariableResponse, status_code=201)
async def create_variable(session: SessionDep, slug: str, data: VariableCreate) -> Variable:
    return await variable_service.create_variable(session, slug, data)


@router.patch("/{variable_id}", response_model=VariableResponse)
async def update_variable(
    session: SessionDep, slug: str, variable_id: uuid.UUID, data: VariableUpdate
) -> Variable:
    return await variable_service.update_variable(session, slug, variable_id, data)


@router.delete("/{variable_id}", status_code=204)
async def delete_variable(session: SessionDep, slug: str, variable_id: uuid.UUID) -> None:
    await variable_service.delete_variable(session, slug, variable_id)
