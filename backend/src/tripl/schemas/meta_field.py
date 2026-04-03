import uuid
from typing import Any

from pydantic import BaseModel, Field


class MetaFieldCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    display_name: str = Field(min_length=1, max_length=255)
    field_type: str = Field(pattern=r"^(string|url|boolean|enum|date)$")
    is_required: bool = False
    enum_options: list[str] | None = None
    default_value: str | None = None
    order: int = 0


class MetaFieldUpdate(BaseModel):
    display_name: str | None = Field(None, min_length=1, max_length=255)
    field_type: str | None = Field(None, pattern=r"^(string|url|boolean|enum|date)$")
    is_required: bool | None = None
    enum_options: list[str] | None = None
    default_value: str | None = None
    order: int | None = None


class MetaFieldResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    display_name: str
    field_type: str
    is_required: bool
    enum_options: list[Any] | None
    default_value: str | None
    order: int

    model_config = {"from_attributes": True}
