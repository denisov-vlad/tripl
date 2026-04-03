from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from tripl.models.base import Base, UUIDMixin


class EventFieldValue(UUIDMixin, Base):
    __tablename__ = "event_field_values"
    __table_args__ = (
        UniqueConstraint(
            "event_id", "field_definition_id", name="uq_event_field_value_event_field"
        ),
    )

    event_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"))
    field_definition_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("field_definitions.id", ondelete="CASCADE")
    )
    value: Mapped[str] = mapped_column(Text, default="")

    event: Mapped[Event] = relationship(back_populates="field_values")  # noqa: F821
    field_definition: Mapped[FieldDefinition] = relationship(lazy="selectin")  # noqa: F821
