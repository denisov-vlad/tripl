from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from tripl.models.base import Base, UUIDMixin


class EventMetaValue(UUIDMixin, Base):
    __tablename__ = "event_meta_values"
    __table_args__ = (
        UniqueConstraint(
            "event_id", "meta_field_definition_id", name="uq_event_meta_value_event_meta"
        ),
    )

    event_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"))
    meta_field_definition_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("meta_field_definitions.id", ondelete="CASCADE")
    )
    value: Mapped[str] = mapped_column(Text, default="")

    event: Mapped[Event] = relationship(back_populates="meta_values")  # noqa: F821
    meta_field_definition: Mapped[MetaFieldDefinition] = relationship(lazy="selectin")  # noqa: F821
