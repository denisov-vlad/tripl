import uuid
from datetime import datetime

from pydantic import BaseModel


class EventMetricPoint(BaseModel):
    bucket: datetime
    count: int
    expected_count: float | None = None
    is_anomaly: bool = False
    anomaly_direction: str | None = None
    z_score: float | None = None


class MetricSignalResponse(BaseModel):
    scan_config_id: uuid.UUID
    scope_type: str
    scope_ref: str
    state: str
    event_id: uuid.UUID | None = None
    event_type_id: uuid.UUID | None = None
    bucket: datetime
    actual_count: int
    expected_count: float
    stddev: float
    z_score: float
    direction: str


class EventMetricsResponse(BaseModel):
    scope: str
    scan_config_id: uuid.UUID | None = None
    event_id: uuid.UUID | None = None
    event_type_id: uuid.UUID | None = None
    interval: str | None = None
    latest_signal: MetricSignalResponse | None = None
    data: list[EventMetricPoint]


class EventWindowMetricsRequest(BaseModel):
    event_ids: list[uuid.UUID]
    time_from: datetime | None = None
    time_to: datetime | None = None


class EventWindowMetricsResponse(BaseModel):
    event_id: uuid.UUID
    scan_config_id: uuid.UUID | None = None
    interval: str | None = None
    total_count: int
    data: list[EventMetricPoint]
