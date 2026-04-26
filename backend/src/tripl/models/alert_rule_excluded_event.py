from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from tripl.models.base import Base, UUIDMixin

if TYPE_CHECKING:
    from tripl.models.alert_rule import AlertRule


class AlertRuleExcludedEvent(UUIDMixin, Base):
    __tablename__ = "alert_rule_excluded_events"
    __table_args__ = (
        UniqueConstraint(
            "rule_id",
            "event_id",
            name="uq_alert_rule_excluded_event",
        ),
        Index("ix_alert_rule_excluded_event_rule", "rule_id"),
    )

    rule_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("alert_rules.id", ondelete="CASCADE"),
    )
    event_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE"),
    )

    rule: Mapped[AlertRule] = relationship(back_populates="excluded_events")
