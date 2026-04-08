import uuid
from datetime import datetime

from pydantic import BaseModel


class EventMetricPoint(BaseModel):
    bucket: datetime
    count: int


class EventMetricsResponse(BaseModel):
    event_id: uuid.UUID | None = None
    event_type_id: uuid.UUID | None = None
    interval: str | None = None
    data: list[EventMetricPoint]
