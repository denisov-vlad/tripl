import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel

ActivityItemType = Literal["anomaly", "scan", "alert", "event"]
ActivityItemSeverity = Literal["high", "medium", "low"]


class ActivityItemResponse(BaseModel):
    id: str
    project_id: uuid.UUID
    project_slug: str
    project_name: str
    type: ActivityItemType
    severity: ActivityItemSeverity
    title: str
    detail: str
    occurred_at: datetime
    target_path: str | None = None
