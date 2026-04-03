import uuid

from pydantic import BaseModel


class RelationCreate(BaseModel):
    source_event_type_id: uuid.UUID
    target_event_type_id: uuid.UUID
    source_field_id: uuid.UUID
    target_field_id: uuid.UUID
    relation_type: str = "belongs_to"
    description: str = ""


class RelationResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    source_event_type_id: uuid.UUID
    target_event_type_id: uuid.UUID
    source_field_id: uuid.UUID
    target_field_id: uuid.UUID
    relation_type: str
    description: str

    model_config = {"from_attributes": True}
