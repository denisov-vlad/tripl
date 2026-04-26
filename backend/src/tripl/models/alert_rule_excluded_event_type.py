from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from tripl.models.base import Base, UUIDMixin

if TYPE_CHECKING:
    from tripl.models.alert_rule import AlertRule


class AlertRuleExcludedEventType(UUIDMixin, Base):
    __tablename__ = "alert_rule_excluded_event_types"
    __table_args__ = (
        UniqueConstraint(
            "rule_id",
            "event_type_id",
            name="uq_alert_rule_excluded_event_type",
        ),
        Index("ix_alert_rule_excluded_event_type_rule", "rule_id"),
    )

    rule_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("alert_rules.id", ondelete="CASCADE"),
    )
    event_type_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("event_types.id", ondelete="CASCADE"),
    )

    rule: Mapped[AlertRule] = relationship(back_populates="excluded_event_types")
