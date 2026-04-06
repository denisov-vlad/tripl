from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from tripl.models.base import Base, TimestampMixin, UUIDMixin


class ScanConfig(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "scan_configs"
    __table_args__ = (UniqueConstraint("data_source_id", "name", name="uq_scan_config_ds_name"),)

    data_source_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("data_sources.id", ondelete="CASCADE")
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE")
    )
    event_type_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("event_types.id", ondelete="SET NULL"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(255))
    base_query: Mapped[str] = mapped_column(Text)
    event_type_column: Mapped[str | None] = mapped_column(String(255), nullable=True)
    time_column: Mapped[str | None] = mapped_column(String(255), nullable=True)
    event_name_format: Mapped[str | None] = mapped_column(String(500), nullable=True)
    cardinality_threshold: Mapped[int] = mapped_column(Integer, default=100)
    schedule: Mapped[str | None] = mapped_column(String(100), nullable=True)

    data_source: Mapped[DataSource] = relationship(back_populates="scan_configs")  # noqa: F821
    event_type: Mapped[EventType | None] = relationship()  # noqa: F821
    scan_jobs: Mapped[list[ScanJob]] = relationship(  # noqa: F821
        back_populates="scan_config", cascade="all, delete-orphan", lazy="selectin"
    )
