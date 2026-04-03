from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from tripl.models.base import Base, UUIDMixin


class EventTypeRelation(UUIDMixin, Base):
    __tablename__ = "event_type_relations"

    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    source_event_type_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("event_types.id", ondelete="CASCADE")
    )
    target_event_type_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("event_types.id", ondelete="CASCADE")
    )
    source_field_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("field_definitions.id", ondelete="CASCADE")
    )
    target_field_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("field_definitions.id", ondelete="CASCADE")
    )
    relation_type: Mapped[str] = mapped_column(String(50), default="belongs_to")
    description: Mapped[str] = mapped_column(Text, default="")

    project: Mapped[Project] = relationship(back_populates="relations")  # noqa: F821
    source_event_type: Mapped[EventType] = relationship(  # noqa: F821
        foreign_keys=[source_event_type_id]
    )
    target_event_type: Mapped[EventType] = relationship(  # noqa: F821
        foreign_keys=[target_event_type_id]
    )
    source_field: Mapped[FieldDefinition] = relationship(  # noqa: F821
        foreign_keys=[source_field_id]
    )
    target_field: Mapped[FieldDefinition] = relationship(  # noqa: F821
        foreign_keys=[target_field_id]
    )
