from __future__ import annotations

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from tripl.models.base import Base, TimestampMixin, UUIDMixin


class Project(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "projects"

    name: Mapped[str] = mapped_column(String(255))
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    description: Mapped[str] = mapped_column(Text, default="")

    event_types: Mapped[list[EventType]] = relationship(  # noqa: F821
        back_populates="project", cascade="all, delete-orphan", lazy="selectin"
    )
    meta_field_definitions: Mapped[list[MetaFieldDefinition]] = relationship(  # noqa: F821
        back_populates="project", cascade="all, delete-orphan", lazy="selectin"
    )
    relations: Mapped[list[EventTypeRelation]] = relationship(  # noqa: F821
        back_populates="project", cascade="all, delete-orphan", lazy="selectin"
    )
    variables: Mapped[list[Variable]] = relationship(  # noqa: F821
        back_populates="project", cascade="all, delete-orphan", lazy="selectin"
    )
