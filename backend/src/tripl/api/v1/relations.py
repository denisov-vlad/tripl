import uuid

from fastapi import APIRouter

from tripl.api.deps import SessionDep
from tripl.schemas.relation import RelationCreate, RelationResponse
from tripl.services import relation_service

router = APIRouter(prefix="/projects/{slug}/relations", tags=["relations"])


@router.get("", response_model=list[RelationResponse])
async def list_relations(session: SessionDep, slug: str):
    return await relation_service.list_relations(session, slug)


@router.post("", response_model=RelationResponse, status_code=201)
async def create_relation(session: SessionDep, slug: str, data: RelationCreate):
    return await relation_service.create_relation(session, slug, data)


@router.delete("/{relation_id}", status_code=204)
async def delete_relation(session: SessionDep, slug: str, relation_id: uuid.UUID):
    await relation_service.delete_relation(session, slug, relation_id)
