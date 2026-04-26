"""replace alert rule exclusions with filters

Revision ID: 5a6b7c8d9e0f
Revises: 4f5a6b7c8d9e
Create Date: 2026-04-26
"""

import json
import uuid
from collections import defaultdict

import sqlalchemy as sa
from alembic import op

revision = "5a6b7c8d9e0f"
down_revision = "4f5a6b7c8d9e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "alert_rule_filters",
        sa.Column("rule_id", sa.Uuid(), nullable=False),
        sa.Column("field", sa.String(length=32), nullable=False),
        sa.Column("operator", sa.String(length=16), nullable=False),
        sa.Column("values", sa.JSON(), nullable=False),
        sa.Column("position", sa.Integer(), server_default="0", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["rule_id"], ["alert_rules.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_alert_rule_filter_rule", "alert_rule_filters", ["rule_id"])

    bind = op.get_bind()

    excluded_types = bind.execute(
        sa.text("SELECT rule_id, event_type_id FROM alert_rule_excluded_event_types")
    ).all()
    excluded_events = bind.execute(
        sa.text("SELECT rule_id, event_id FROM alert_rule_excluded_events")
    ).all()

    grouped_types: dict[str, list[str]] = defaultdict(list)
    grouped_events: dict[str, list[str]] = defaultdict(list)
    for rule_id, event_type_id in excluded_types:
        grouped_types[str(rule_id)].append(str(event_type_id))
    for rule_id, event_id in excluded_events:
        grouped_events[str(rule_id)].append(str(event_id))

    filters_table = sa.table(
        "alert_rule_filters",
        sa.column("id", sa.Uuid()),
        sa.column("rule_id", sa.Uuid()),
        sa.column("field", sa.String()),
        sa.column("operator", sa.String()),
        sa.column("values", sa.JSON()),
        sa.column("position", sa.Integer()),
    )

    rows: list[dict[str, object]] = []
    for rule_id_str, ids in grouped_types.items():
        rows.append(
            {
                "id": uuid.uuid4(),
                "rule_id": uuid.UUID(rule_id_str),
                "field": "event_type",
                "operator": "not_in",
                "values": json.dumps(ids),
                "position": 0,
            }
        )
    for rule_id_str, ids in grouped_events.items():
        rows.append(
            {
                "id": uuid.uuid4(),
                "rule_id": uuid.UUID(rule_id_str),
                "field": "event",
                "operator": "not_in",
                "values": json.dumps(ids),
                "position": 1,
            }
        )

    if rows:
        op.bulk_insert(filters_table, rows)

    op.drop_index(
        "ix_alert_rule_excluded_event_rule",
        table_name="alert_rule_excluded_events",
    )
    op.drop_table("alert_rule_excluded_events")
    op.drop_index(
        "ix_alert_rule_excluded_event_type_rule",
        table_name="alert_rule_excluded_event_types",
    )
    op.drop_table("alert_rule_excluded_event_types")


def downgrade() -> None:
    op.create_table(
        "alert_rule_excluded_event_types",
        sa.Column("rule_id", sa.Uuid(), nullable=False),
        sa.Column("event_type_id", sa.Uuid(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["event_type_id"], ["event_types.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["rule_id"], ["alert_rules.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "rule_id",
            "event_type_id",
            name="uq_alert_rule_excluded_event_type",
        ),
    )
    op.create_index(
        "ix_alert_rule_excluded_event_type_rule",
        "alert_rule_excluded_event_types",
        ["rule_id"],
    )

    op.create_table(
        "alert_rule_excluded_events",
        sa.Column("rule_id", sa.Uuid(), nullable=False),
        sa.Column("event_id", sa.Uuid(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["rule_id"], ["alert_rules.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("rule_id", "event_id", name="uq_alert_rule_excluded_event"),
    )
    op.create_index(
        "ix_alert_rule_excluded_event_rule",
        "alert_rule_excluded_events",
        ["rule_id"],
    )

    op.drop_index("ix_alert_rule_filter_rule", table_name="alert_rule_filters")
    op.drop_table("alert_rule_filters")
