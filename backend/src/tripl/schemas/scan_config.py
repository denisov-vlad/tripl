import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from tripl.json_paths import normalize_json_value_paths

VALID_INTERVALS = ("15m", "1h", "6h", "1d", "1w")


class ScanConfigCreate(BaseModel):
    data_source_id: uuid.UUID
    event_type_id: uuid.UUID | None = None
    name: str = Field(min_length=1, max_length=255)
    base_query: str = Field(min_length=1)
    event_type_column: str | None = None
    time_column: str | None = None
    event_name_format: str | None = None
    json_value_paths: list[str] = Field(default_factory=list)
    cardinality_threshold: int = Field(default=100, ge=1)
    interval: str | None = Field(None, pattern=r"^(15m|1h|6h|1d|1w)$")

    @field_validator("json_value_paths")
    @classmethod
    def validate_json_value_paths(cls, value: list[str]) -> list[str]:
        normalized = normalize_json_value_paths(value)
        invalid = sorted(set(value) - set(normalized))
        if invalid:
            raise ValueError("json_value_paths must use <json_column>.<nested.path> format")
        return normalized


class ScanConfigUpdate(BaseModel):
    event_type_id: uuid.UUID | None = None
    name: str | None = Field(None, min_length=1, max_length=255)
    base_query: str | None = Field(None, min_length=1)
    event_type_column: str | None = None
    time_column: str | None = None
    event_name_format: str | None = None
    json_value_paths: list[str] | None = None
    cardinality_threshold: int | None = Field(None, ge=1)
    interval: str | None = Field(None, pattern=r"^(15m|1h|6h|1d|1w)$")

    @field_validator("json_value_paths")
    @classmethod
    def validate_json_value_paths(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        normalized = normalize_json_value_paths(value)
        invalid = sorted(set(value) - set(normalized))
        if invalid:
            raise ValueError("json_value_paths must use <json_column>.<nested.path> format")
        return normalized


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
    json_value_paths: list[str]
    cardinality_threshold: int
    interval: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ScanPreviewColumnResponse(BaseModel):
    name: str
    type_name: str
    is_nullable: bool


class ScanPreviewJsonPathResponse(BaseModel):
    full_path: str
    path: str
    sample_values: list[str]


class ScanPreviewJsonColumnResponse(BaseModel):
    column: str
    paths: list[ScanPreviewJsonPathResponse]


class ScanConfigPreviewRequest(BaseModel):
    data_source_id: uuid.UUID
    base_query: str = Field(min_length=1)
    limit: int = Field(default=10, ge=1, le=50)


class ScanConfigPreviewResponse(BaseModel):
    columns: list[ScanPreviewColumnResponse]
    rows: list[dict[str, object]]
    json_columns: list[ScanPreviewJsonColumnResponse]
