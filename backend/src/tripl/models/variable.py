from __future__ import annotations

import enum
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from tripl.models.base import Base, UUIDMixin

if TYPE_CHECKING:
    from tripl.models.project import Project


class VariableType(enum.StrEnum):
    string = "string"
    number = "number"
    boolean = "boolean"
    date = "date"
    datetime = "datetime"
    json = "json"
    string_array = "string_array"
    number_array = "number_array"


class Variable(UUIDMixin, Base):
    __tablename__ = "variables"
    __table_args__ = (
        UniqueConstraint("project_id", "name", name="uq_variable_project_name"),
        UniqueConstraint("project_id", "source_name", name="uq_variable_project_source_name"),
    )

    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(100))
    source_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    variable_type: Mapped[str] = mapped_column(String(20), default=VariableType.string.value)
    description: Mapped[str] = mapped_column(Text, default="")

    project: Mapped[Project] = relationship(back_populates="variables")
