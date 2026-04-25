from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from tripl.models.base import Base, UUIDMixin


class EventTag(UUIDMixin, Base):
    __tablename__ = "event_tags"
    __table_args__ = (
        UniqueConstraint("event_id", "name", name="uq_event_tag"),
        Index("ix_event_tag_name", "name"),
    )

    event_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(100))

    event: Mapped[Event] = relationship(back_populates="tags")  # noqa: F821
