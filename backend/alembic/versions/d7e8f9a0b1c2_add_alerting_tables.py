"""add alerting tables

Revision ID: d7e8f9a0b1c2
Revises: c9d0e1f2a3b4
Create Date: 2026-04-11
"""

import sqlalchemy as sa
from alembic import op

revision = "d7e8f9a0b1c2"
down_revision = "c9d0e1f2a3b4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "alert_destinations",
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("type", sa.String(length=32), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("enabled", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("webhook_url_encrypted", sa.Text(), nullable=True),
        sa.Column("bot_token_encrypted", sa.Text(), nullable=True),
        sa.Column("chat_id", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_alert_destination_project", "alert_destinations", ["project_id"])

    op.create_table(
        "alert_rules",
        sa.Column("destination_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("enabled", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("include_project_total", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("include_event_types", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("include_events", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("notify_on_spike", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("notify_on_drop", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("min_percent_delta", sa.Float(), server_default="0", nullable=False),
        sa.Column("min_absolute_delta", sa.Float(), server_default="0", nullable=False),
        sa.Column("min_expected_count", sa.Float(), server_default="0", nullable=False),
        sa.Column("cooldown_minutes", sa.Integer(), server_default="1440", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["destination_id"], ["alert_destinations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_alert_rule_destination", "alert_rules", ["destination_id"])

    op.create_table(
        "alert_deliveries",
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("scan_config_id", sa.Uuid(), nullable=False),
        sa.Column("scan_job_id", sa.Uuid(), nullable=True),
        sa.Column("destination_id", sa.Uuid(), nullable=False),
        sa.Column("rule_id", sa.Uuid(), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="pending", nullable=False),
        sa.Column("channel", sa.String(length=32), nullable=False),
        sa.Column("matched_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("payload_snapshot", sa.JSON(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["destination_id"], ["alert_destinations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["rule_id"], ["alert_rules.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["scan_config_id"], ["scan_configs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["scan_job_id"], ["scan_jobs.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_alert_delivery_project_created", "alert_deliveries", ["project_id", "created_at"])
    op.create_index("ix_alert_delivery_destination_created", "alert_deliveries", ["destination_id", "created_at"])
    op.create_index("ix_alert_delivery_rule_created", "alert_deliveries", ["rule_id", "created_at"])
    op.create_index("ix_alert_delivery_scan_created", "alert_deliveries", ["scan_config_id", "created_at"])

    op.create_table(
        "alert_rule_states",
        sa.Column("rule_id", sa.Uuid(), nullable=False),
        sa.Column("scan_config_id", sa.Uuid(), nullable=False),
        sa.Column("scope_type", sa.String(length=32), nullable=False),
        sa.Column("scope_ref", sa.String(length=64), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("opened_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_anomaly_bucket", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_notified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_notified_delivery_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["last_notified_delivery_id"], ["alert_deliveries.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["rule_id"], ["alert_rules.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["scan_config_id"], ["scan_configs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("rule_id", "scan_config_id", "scope_type", "scope_ref", name="uq_alert_rule_state_scope"),
    )
    op.create_index("ix_alert_rule_state_rule", "alert_rule_states", ["rule_id"])
    op.create_index("ix_alert_rule_state_scan", "alert_rule_states", ["scan_config_id"])

    op.create_table(
        "alert_rule_excluded_event_types",
        sa.Column("rule_id", sa.Uuid(), nullable=False),
        sa.Column("event_type_id", sa.Uuid(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["event_type_id"], ["event_types.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["rule_id"], ["alert_rules.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("rule_id", "event_type_id", name="uq_alert_rule_excluded_event_type"),
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

    op.create_table(
        "alert_delivery_items",
        sa.Column("delivery_id", sa.Uuid(), nullable=False),
        sa.Column("scope_type", sa.String(length=32), nullable=False),
        sa.Column("scope_ref", sa.String(length=64), nullable=False),
        sa.Column("event_type_id", sa.Uuid(), nullable=True),
        sa.Column("event_id", sa.Uuid(), nullable=True),
        sa.Column("bucket", sa.DateTime(timezone=True), nullable=False),
        sa.Column("direction", sa.String(length=16), nullable=False),
        sa.Column("actual_count", sa.Integer(), nullable=False),
        sa.Column("expected_count", sa.Float(), nullable=False),
        sa.Column("absolute_delta", sa.Float(), nullable=False),
        sa.Column("percent_delta", sa.Float(), nullable=False),
        sa.Column("monitoring_path", sa.String(length=500), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["delivery_id"], ["alert_deliveries.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["event_type_id"], ["event_types.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_alert_delivery_item_delivery", "alert_delivery_items", ["delivery_id"])


def downgrade() -> None:
    op.drop_index("ix_alert_delivery_item_delivery", table_name="alert_delivery_items")
    op.drop_table("alert_delivery_items")
    op.drop_index("ix_alert_rule_excluded_event_rule", table_name="alert_rule_excluded_events")
    op.drop_table("alert_rule_excluded_events")
    op.drop_index("ix_alert_rule_excluded_event_type_rule", table_name="alert_rule_excluded_event_types")
    op.drop_table("alert_rule_excluded_event_types")
    op.drop_index("ix_alert_rule_state_scan", table_name="alert_rule_states")
    op.drop_index("ix_alert_rule_state_rule", table_name="alert_rule_states")
    op.drop_table("alert_rule_states")
    op.drop_index("ix_alert_delivery_scan_created", table_name="alert_deliveries")
    op.drop_index("ix_alert_delivery_rule_created", table_name="alert_deliveries")
    op.drop_index("ix_alert_delivery_destination_created", table_name="alert_deliveries")
    op.drop_index("ix_alert_delivery_project_created", table_name="alert_deliveries")
    op.drop_table("alert_deliveries")
    op.drop_index("ix_alert_rule_destination", table_name="alert_rules")
    op.drop_table("alert_rules")
    op.drop_index("ix_alert_destination_project", table_name="alert_destinations")
    op.drop_table("alert_destinations")
