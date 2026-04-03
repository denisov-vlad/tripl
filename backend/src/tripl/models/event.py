from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from tripl.models.base import Base, TimestampMixin, UUIDMixin


class Event(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "events"

    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    event_type_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("event_types.id", ondelete="CASCADE")
    )
    name: Mapped[str] = mapped_column(String(500))
    description: Mapped[str] = mapped_column(Text, default="")

    event_type: Mapped[EventType] = relationship(lazy="selectin")  # noqa: F821
    field_values: Mapped[list[EventFieldValue]] = relationship(  # noqa: F821
        back_populates="event", cascade="all, delete-orphan", lazy="selectin"
    )
    meta_values: Mapped[list[EventMetaValue]] = relationship(  # noqa: F821
        back_populates="event", cascade="all, delete-orphan", lazy="selectin"
    )
