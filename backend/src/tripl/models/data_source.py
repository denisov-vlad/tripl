from __future__ import annotations

import enum

import sqlalchemy as sa
from sqlalchemy import Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from tripl.models.base import Base, TimestampMixin, UUIDMixin


class DBType(enum.StrEnum):
    clickhouse = "clickhouse"


class DataSource(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "data_sources"
    __table_args__ = (UniqueConstraint("name", name="uq_data_source_name"),)

    name: Mapped[str] = mapped_column(String(255))
    db_type: Mapped[str] = mapped_column(String(20))  # clickhouse, bigquery, ...
    host: Mapped[str] = mapped_column(String(500))
    port: Mapped[int] = mapped_column(Integer, default=8123)
    database_name: Mapped[str] = mapped_column(String(255))
    username: Mapped[str] = mapped_column(String(255), default="")
    password_encrypted: Mapped[str] = mapped_column(Text, default="")
    extra_params: Mapped[dict | None] = mapped_column(sa.JSON, nullable=True)

    scan_configs: Mapped[list[ScanConfig]] = relationship(  # noqa: F821
        back_populates="data_source", cascade="all, delete-orphan", lazy="selectin"
    )
