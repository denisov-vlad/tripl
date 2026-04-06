"""add time_column, event_name_format to scan_configs and reviewed to events

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-04-06 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("scan_configs", sa.Column("time_column", sa.String(255), nullable=True))
    op.add_column("scan_configs", sa.Column("event_name_format", sa.String(500), nullable=True))
    op.add_column(
        "events",
        sa.Column("reviewed", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )


def downgrade() -> None:
    op.drop_column("events", "reviewed")
    op.drop_column("scan_configs", "event_name_format")
    op.drop_column("scan_configs", "time_column")
