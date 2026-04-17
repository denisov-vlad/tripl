"""add scan preview json value paths and alert item labels

Revision ID: e8f9a0b1c2d3
Revises: d7e8f9a0b1c2
Create Date: 2026-04-12
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "e8f9a0b1c2d3"
down_revision = "d7e8f9a0b1c2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "scan_configs",
        sa.Column(
            "json_value_paths",
            sa.JSON(),
            nullable=False,
            server_default="[]",
        ),
    )

    with op.batch_alter_table("alert_delivery_items") as batch_op:
        batch_op.add_column(sa.Column("scope_name", sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column("details_path", sa.String(length=500), nullable=True))

    op.execute("UPDATE alert_delivery_items SET scope_name = scope_ref WHERE scope_name IS NULL")

    with op.batch_alter_table("alert_delivery_items") as batch_op:
        batch_op.alter_column("scope_name", existing_type=sa.String(length=255), nullable=False)
        batch_op.alter_column(
            "expected_count",
            existing_type=sa.Float(),
            type_=sa.Integer(),
            postgresql_using="ROUND(expected_count)",
        )
        batch_op.alter_column(
            "absolute_delta",
            existing_type=sa.Float(),
            type_=sa.Integer(),
            postgresql_using="ROUND(absolute_delta)",
        )


def downgrade() -> None:
    with op.batch_alter_table("alert_delivery_items") as batch_op:
        batch_op.alter_column(
            "absolute_delta",
            existing_type=sa.Integer(),
            type_=sa.Float(),
        )
        batch_op.alter_column(
            "expected_count",
            existing_type=sa.Integer(),
            type_=sa.Float(),
        )
        batch_op.drop_column("details_path")
        batch_op.drop_column("scope_name")

    op.drop_column("scan_configs", "json_value_paths")
