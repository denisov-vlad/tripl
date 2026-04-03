import uuid
from typing import Any

from pydantic import BaseModel, Field


class FieldDefinitionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    display_name: str = Field(min_length=1, max_length=255)
    field_type: str = Field(pattern=r"^(string|number|boolean|json|enum|url)$")
    is_required: bool = False
    enum_options: list[str] | None = None
    description: str = ""
    order: int = 0


class FieldDefinitionUpdate(BaseModel):
    display_name: str | None = Field(None, min_length=1, max_length=255)
    field_type: str | None = Field(None, pattern=r"^(string|number|boolean|json|enum|url)$")
    is_required: bool | None = None
    enum_options: list[str] | None = None
    description: str | None = None
    order: int | None = None


class FieldDefinitionResponse(BaseModel):
    id: uuid.UUID
    event_type_id: uuid.UUID
    name: str
    display_name: str
    field_type: str
    is_required: bool
    enum_options: list[Any] | None
    description: str
    order: int

    model_config = {"from_attributes": True}


class FieldReorder(BaseModel):
    field_ids: list[uuid.UUID]
