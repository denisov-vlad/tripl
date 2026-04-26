from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import JSON, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from tripl.models.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from tripl.models.alert_rule import AlertRule


class AlertRuleFilter(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "alert_rule_filters"
    __table_args__ = (Index("ix_alert_rule_filter_rule", "rule_id"),)

    rule_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("alert_rules.id", ondelete="CASCADE"),
    )
    field: Mapped[str] = mapped_column(String(32))
    operator: Mapped[str] = mapped_column(String(16))
    values: Mapped[list[str]] = mapped_column(JSON, default=list)
    position: Mapped[int] = mapped_column(Integer, default=0, server_default="0")

    rule: Mapped[AlertRule] = relationship(back_populates="filters")
