from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from tripl.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from tripl.models.event_type import EventType
    from tripl.models.event_type_relation import EventTypeRelation
    from tripl.models.meta_field_definition import MetaFieldDefinition
    from tripl.models.variable import Variable


class Project(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "projects"

    name: Mapped[str] = mapped_column(String(255))
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    description: Mapped[str] = mapped_column(Text, default="")

    event_types: Mapped[list[EventType]] = relationship(
        back_populates="project", cascade="all, delete-orphan", lazy="selectin"
    )
    meta_field_definitions: Mapped[list[MetaFieldDefinition]] = relationship(
        back_populates="project", cascade="all, delete-orphan", lazy="selectin"
    )
    relations: Mapped[list[EventTypeRelation]] = relationship(
        back_populates="project", cascade="all, delete-orphan", lazy="selectin"
    )
    variables: Mapped[list[Variable]] = relationship(
        back_populates="project", cascade="all, delete-orphan", lazy="selectin"
    )
