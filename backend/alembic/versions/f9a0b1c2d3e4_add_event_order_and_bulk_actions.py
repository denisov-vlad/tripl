"""add event order

Revision ID: f9a0b1c2d3e4
Revises: e8f9a0b1c2d3
Create Date: 2026-04-12
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "f9a0b1c2d3e4"
down_revision = "e8f9a0b1c2d3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "events",
        sa.Column("order", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index("ix_events_project_order", "events", ["project_id", "order"])

    op.execute(
        """
        WITH ordered_events AS (
            SELECT
                id,
                ROW_NUMBER() OVER (
                    PARTITION BY project_id
                    ORDER BY created_at, id
                ) - 1 AS seq
            FROM events
        )
        UPDATE events
        SET "order" = ordered_events.seq
        FROM ordered_events
        WHERE events.id = ordered_events.id
        """
    )


def downgrade() -> None:
    op.drop_index("ix_events_project_order", table_name="events")
    op.drop_column("events", "order")
