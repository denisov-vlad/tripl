"""add link template to meta fields

Revision ID: c9d0e1f2a3b4
Revises: b8c9d0e1f2a3
Create Date: 2026-04-10
"""

import sqlalchemy as sa
from alembic import op

revision = "c9d0e1f2a3b4"
down_revision = "b8c9d0e1f2a3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "meta_field_definitions",
        sa.Column("link_template", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("meta_field_definitions", "link_template")
