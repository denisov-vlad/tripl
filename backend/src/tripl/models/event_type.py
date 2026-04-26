from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from tripl.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from tripl.models.field_definition import FieldDefinition
    from tripl.models.project import Project


class EventType(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "event_types"
    __table_args__ = (UniqueConstraint("project_id", "name", name="uq_event_type_project_name"),)

    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(100))
    display_name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text, default="")
    color: Mapped[str] = mapped_column(String(7), default="#6366f1")
    order: Mapped[int] = mapped_column(Integer, default=0)

    project: Mapped[Project] = relationship(back_populates="event_types")
    field_definitions: Mapped[list[FieldDefinition]] = relationship(
        back_populates="event_type", cascade="all, delete-orphan", lazy="selectin"
    )
