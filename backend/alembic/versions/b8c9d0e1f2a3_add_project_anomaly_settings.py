"""add project anomaly settings

Revision ID: b8c9d0e1f2a3
Revises: a7b8c9d0e1f2
Create Date: 2026-04-10
"""

from __future__ import annotations

import uuid

import sqlalchemy as sa
from alembic import op

revision = "b8c9d0e1f2a3"
down_revision = "a7b8c9d0e1f2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "project_anomaly_settings",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("anomaly_detection_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("detect_project_total", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("detect_event_types", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("detect_events", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("baseline_window_buckets", sa.Integer(), nullable=False, server_default="14"),
        sa.Column("min_history_buckets", sa.Integer(), nullable=False, server_default="7"),
        sa.Column("sigma_threshold", sa.Float(), nullable=False, server_default="3.0"),
        sa.Column("min_expected_count", sa.Integer(), nullable=False, server_default="10"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("project_id", name="uq_project_anomaly_settings_project"),
    )

    connection = op.get_bind()
    scan_configs = sa.table(
        "scan_configs",
        sa.column("project_id", sa.Uuid()),
        sa.column("updated_at", sa.DateTime(timezone=True)),
        sa.column("anomaly_detection_enabled", sa.Boolean()),
        sa.column("detect_project_total", sa.Boolean()),
        sa.column("detect_event_types", sa.Boolean()),
        sa.column("detect_events", sa.Boolean()),
        sa.column("baseline_window_buckets", sa.Integer()),
        sa.column("min_history_buckets", sa.Integer()),
        sa.column("sigma_threshold", sa.Float()),
        sa.column("min_expected_count", sa.Integer()),
    )
    settings_table = sa.table(
        "project_anomaly_settings",
        sa.column("id", sa.Uuid()),
        sa.column("project_id", sa.Uuid()),
        sa.column("anomaly_detection_enabled", sa.Boolean()),
        sa.column("detect_project_total", sa.Boolean()),
        sa.column("detect_event_types", sa.Boolean()),
        sa.column("detect_events", sa.Boolean()),
        sa.column("baseline_window_buckets", sa.Integer()),
        sa.column("min_history_buckets", sa.Integer()),
        sa.column("sigma_threshold", sa.Float()),
        sa.column("min_expected_count", sa.Integer()),
    )

    rows = connection.execute(
        sa.select(scan_configs).order_by(scan_configs.c.project_id, scan_configs.c.updated_at.desc())
    ).mappings()
    inserted_projects: set[uuid.UUID] = set()
    for row in rows:
        project_id = row["project_id"]
        if project_id in inserted_projects:
            continue
        inserted_projects.add(project_id)
        connection.execute(
            settings_table.insert().values(
                id=uuid.uuid4(),
                project_id=project_id,
                anomaly_detection_enabled=row["anomaly_detection_enabled"],
                detect_project_total=row["detect_project_total"],
                detect_event_types=row["detect_event_types"],
                detect_events=row["detect_events"],
                baseline_window_buckets=row["baseline_window_buckets"],
                min_history_buckets=row["min_history_buckets"],
                sigma_threshold=row["sigma_threshold"],
                min_expected_count=row["min_expected_count"],
            )
        )


def downgrade() -> None:
    op.drop_table("project_anomaly_settings")
