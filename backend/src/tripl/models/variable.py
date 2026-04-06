from __future__ import annotations

import enum
import uuid

from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from tripl.models.base import Base, UUIDMixin


class VariableType(str, enum.Enum):
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
    __table_args__ = (UniqueConstraint("project_id", "name", name="uq_variable_project_name"),)

    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(100))
    variable_type: Mapped[str] = mapped_column(String(20), default=VariableType.string.value)
    description: Mapped[str] = mapped_column(Text, default="")

    project: Mapped[Project] = relationship(back_populates="variables")  # noqa: F821
