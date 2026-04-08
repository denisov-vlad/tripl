import uuid
from datetime import datetime

from pydantic import BaseModel, Field

VALID_INTERVALS = ("15m", "1h", "6h", "1d", "1w")


class ScanConfigCreate(BaseModel):
    data_source_id: uuid.UUID
    event_type_id: uuid.UUID | None = None
    name: str = Field(min_length=1, max_length=255)
    base_query: str = Field(min_length=1)
    event_type_column: str | None = None
    time_column: str | None = None
    event_name_format: str | None = None
    cardinality_threshold: int = Field(default=100, ge=1)
    interval: str | None = Field(None, pattern=r"^(15m|1h|6h|1d|1w)$")


class ScanConfigUpdate(BaseModel):
    event_type_id: uuid.UUID | None = None
    name: str | None = Field(None, min_length=1, max_length=255)
    base_query: str | None = Field(None, min_length=1)
    event_type_column: str | None = None
    time_column: str | None = None
    event_name_format: str | None = None
    cardinality_threshold: int | None = Field(None, ge=1)
    interval: str | None = Field(None, pattern=r"^(15m|1h|6h|1d|1w)$")


class ScanConfigResponse(BaseModel):
    id: uuid.UUID
    data_source_id: uuid.UUID
    project_id: uuid.UUID
    event_type_id: uuid.UUID | None
    name: str
    base_query: str
    event_type_column: str | None
    time_column: str | None
    event_name_format: str | None
    cardinality_threshold: int
    interval: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
