"""add alert rule message templates

Revision ID: 0a1b2c3d4e5f
Revises: f9a0b1c2d3e4
Create Date: 2026-04-13
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0a1b2c3d4e5f"
down_revision = "f9a0b1c2d3e4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "alert_rules",
        sa.Column("message_template", sa.Text(), nullable=True),
    )
    op.add_column(
        "alert_rules",
        sa.Column(
            "message_format",
            sa.String(length=64),
            nullable=False,
            server_default="plain",
        ),
    )


def downgrade() -> None:
    op.drop_column("alert_rules", "message_format")
    op.drop_column("alert_rules", "message_template")
