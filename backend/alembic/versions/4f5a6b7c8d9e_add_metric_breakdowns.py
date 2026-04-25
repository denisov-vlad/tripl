"""add metric breakdowns

Revision ID: 4f5a6b7c8d9e
Revises: 3e4f5a6b7c8d
Create Date: 2026-04-25
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "4f5a6b7c8d9e"
down_revision = "3e4f5a6b7c8d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "scan_configs",
        sa.Column(
            "metric_breakdown_columns",
            sa.JSON(),
            nullable=False,
            server_default="[]",
        ),
    )
    op.add_column(
        "scan_configs",
        sa.Column("metric_breakdown_values_limit", sa.Integer(), nullable=True),
    )

    op.create_table(
        "event_metric_breakdowns",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("scan_config_id", sa.Uuid(), nullable=False),
        sa.Column("event_id", sa.Uuid(), nullable=True),
        sa.Column("event_type_id", sa.Uuid(), nullable=True),
        sa.Column("bucket", sa.DateTime(timezone=True), nullable=False),
        sa.Column("breakdown_column", sa.String(length=255), nullable=False),
        sa.Column("breakdown_value", sa.String(length=500), nullable=False),
        sa.Column("is_other", sa.Boolean(), nullable=False),
        sa.Column("count", sa.BigInteger(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["scan_config_id"], ["scan_configs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["event_type_id"], ["event_types.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "scan_config_id",
            "event_id",
            "bucket",
            "breakdown_column",
            "breakdown_value",
            "is_other",
            name="uq_event_metric_breakdown_config_event_bucket_value",
        ),
        sa.UniqueConstraint(
            "scan_config_id",
            "event_type_id",
            "bucket",
            "breakdown_column",
            "breakdown_value",
            "is_other",
            name="uq_event_metric_breakdown_config_type_bucket_value",
        ),
    )
    op.create_index(
        "ix_event_metric_breakdown_event_bucket",
        "event_metric_breakdowns",
        ["event_id", "breakdown_column", "bucket"],
    )
    op.create_index(
        "ix_event_metric_breakdown_type_bucket",
        "event_metric_breakdowns",
        ["event_type_id", "breakdown_column", "bucket"],
    )
    op.create_index(
        "ix_event_metric_breakdown_config_column_bucket",
        "event_metric_breakdowns",
        ["scan_config_id", "breakdown_column", "bucket"],
    )

    op.create_table(
        "metric_breakdown_anomalies",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("scan_config_id", sa.Uuid(), nullable=False),
        sa.Column("scope_type", sa.String(length=32), nullable=False),
        sa.Column("scope_ref", sa.String(length=64), nullable=False),
        sa.Column("event_id", sa.Uuid(), nullable=True),
        sa.Column("event_type_id", sa.Uuid(), nullable=True),
        sa.Column("bucket", sa.DateTime(timezone=True), nullable=False),
        sa.Column("breakdown_column", sa.String(length=255), nullable=False),
        sa.Column("breakdown_value", sa.String(length=500), nullable=False),
        sa.Column("is_other", sa.Boolean(), nullable=False),
        sa.Column("actual_count", sa.BigInteger(), nullable=False),
        sa.Column("expected_count", sa.Float(), nullable=False),
        sa.Column("stddev", sa.Float(), nullable=False),
        sa.Column("z_score", sa.Float(), nullable=False),
        sa.Column("direction", sa.String(length=16), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["scan_config_id"], ["scan_configs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["event_type_id"], ["event_types.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "scan_config_id",
            "scope_type",
            "scope_ref",
            "breakdown_column",
            "breakdown_value",
            "is_other",
            "bucket",
            name="uq_metric_breakdown_anomaly_scope_bucket_value",
        ),
    )
    op.create_index(
        "ix_metric_breakdown_anomaly_scope_bucket",
        "metric_breakdown_anomalies",
        [
            "scan_config_id",
            "scope_type",
            "scope_ref",
            "breakdown_column",
            "breakdown_value",
            "is_other",
            "bucket",
        ],
    )
    op.create_index(
        "ix_metric_breakdown_anomaly_event_bucket",
        "metric_breakdown_anomalies",
        ["event_id", "breakdown_column", "bucket"],
    )
    op.create_index(
        "ix_metric_breakdown_anomaly_type_bucket",
        "metric_breakdown_anomalies",
        ["event_type_id", "breakdown_column", "bucket"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_metric_breakdown_anomaly_type_bucket", table_name="metric_breakdown_anomalies"
    )
    op.drop_index(
        "ix_metric_breakdown_anomaly_event_bucket", table_name="metric_breakdown_anomalies"
    )
    op.drop_index(
        "ix_metric_breakdown_anomaly_scope_bucket", table_name="metric_breakdown_anomalies"
    )
    op.drop_table("metric_breakdown_anomalies")

    op.drop_index(
        "ix_event_metric_breakdown_config_column_bucket", table_name="event_metric_breakdowns"
    )
    op.drop_index("ix_event_metric_breakdown_type_bucket", table_name="event_metric_breakdowns")
    op.drop_index("ix_event_metric_breakdown_event_bucket", table_name="event_metric_breakdowns")
    op.drop_table("event_metric_breakdowns")

    op.drop_column("scan_configs", "metric_breakdown_values_limit")
    op.drop_column("scan_configs", "metric_breakdown_columns")
