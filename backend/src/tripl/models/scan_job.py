from __future__ import annotations

import enum
import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import DateTime, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from tripl.models.base import Base, TimestampMixin, UUIDMixin


class ScanJobStatus(enum.StrEnum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"


class ScanJob(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "scan_jobs"
    __table_args__ = (Index("ix_scan_job_config", "scan_config_id"),)

    scan_config_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("scan_configs.id", ondelete="CASCADE")
    )
    status: Mapped[str] = mapped_column(String(20), default=ScanJobStatus.pending.value)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    result_summary: Mapped[dict | None] = mapped_column(sa.JSON, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    scan_config: Mapped[ScanConfig] = relationship(back_populates="scan_jobs")  # noqa: F821
