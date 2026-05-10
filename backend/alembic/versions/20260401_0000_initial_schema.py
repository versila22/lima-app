"""Initial schema — creates all core tables.

Revision ID: 20260401_0000
Revises:
Create Date: 2026-04-01 00:00:00

This migration creates the foundational tables. Subsequent migrations layer on
activity_logs, app_settings, performance indexes, and column additions.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260401_0000"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # members — no FK dependencies
    # ------------------------------------------------------------------
    op.create_table(
        "members",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=True),
        sa.Column("first_name", sa.String(100), nullable=False),
        sa.Column("last_name", sa.String(100), nullable=False),
        sa.Column("phone", sa.String(20), nullable=True),
        sa.Column("date_of_birth", sa.Date(), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("postal_code", sa.String(10), nullable=True),
        sa.Column("city", sa.String(100), nullable=True),
        sa.Column("app_role", sa.String(20), nullable=False, server_default="member"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("activation_token", sa.String(255), nullable=True),
        sa.Column("activation_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reset_token", sa.String(255), nullable=True),
        sa.Column("reset_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    # Note: ix_members_activation_token, ix_members_reset_token, ix_members_app_role
    # are added by migration 20260406_2230 (performance indexes).

    # ------------------------------------------------------------------
    # seasons — no FK dependencies
    # ------------------------------------------------------------------
    op.create_table(
        "seasons",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(50), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("is_current", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    # ------------------------------------------------------------------
    # venues — no FK dependencies
    # ------------------------------------------------------------------
    op.create_table(
        "venues",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("city", sa.String(100), nullable=True),
        sa.Column("contact_info", sa.Text(), nullable=True),
        sa.Column("is_home", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    # ------------------------------------------------------------------
    # commissions — no FK dependencies
    # ------------------------------------------------------------------
    op.create_table(
        "commissions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("code", sa.String(20), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )

    # ------------------------------------------------------------------
    # member_seasons — FK to members, seasons
    # ------------------------------------------------------------------
    op.create_table(
        "member_seasons",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("member_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("season_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("player_status", sa.String(10), nullable=False, server_default="A"),
        sa.Column("membership_fee", sa.DECIMAL(6, 2), nullable=True),
        sa.Column("player_fee", sa.DECIMAL(6, 2), nullable=True),
        sa.Column("helloasso_ref", sa.String(50), nullable=True),
        sa.Column("asso_role", sa.String(50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("member_id", "season_id"),
        sa.ForeignKeyConstraint(["member_id"], ["members.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["season_id"], ["seasons.id"], ondelete="CASCADE"),
    )

    # ------------------------------------------------------------------
    # member_commissions — FK to members, commissions, seasons
    # ------------------------------------------------------------------
    op.create_table(
        "member_commissions",
        sa.Column("member_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("commission_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("season_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.PrimaryKeyConstraint("member_id", "commission_id", "season_id"),
        sa.ForeignKeyConstraint(["member_id"], ["members.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["commission_id"], ["commissions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["season_id"], ["seasons.id"], ondelete="CASCADE"),
    )

    # ------------------------------------------------------------------
    # events — FK to seasons, venues
    # ------------------------------------------------------------------
    op.create_table(
        "events",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("season_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("venue_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("event_type", sa.String(30), nullable=False),
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_away", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("away_city", sa.String(100), nullable=True),
        sa.Column("away_opponent", sa.String(200), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("visibility", sa.String(20), nullable=False, server_default="all"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["season_id"], ["seasons.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["venue_id"], ["venues.id"]),
    )
    op.create_index("idx_events_season", "events", ["season_id"])
    op.create_index("idx_events_start", "events", ["start_at"])
    op.create_index("idx_events_type", "events", ["event_type"])

    # ------------------------------------------------------------------
    # alignments — FK to seasons, members
    # ------------------------------------------------------------------
    op.create_table(
        "alignments",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("season_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["season_id"], ["seasons.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["members.id"]),
    )
    # Note: ix_alignments_season_status is added by migration 20260406_2230.

    # ------------------------------------------------------------------
    # alignment_events — FK to alignments, events
    # ------------------------------------------------------------------
    op.create_table(
        "alignment_events",
        sa.Column("alignment_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("event_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.PrimaryKeyConstraint("alignment_id", "event_id"),
        sa.ForeignKeyConstraint(["alignment_id"], ["alignments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"], ondelete="CASCADE"),
    )

    # ------------------------------------------------------------------
    # alignment_assignments — FK to alignments, events, members
    # ------------------------------------------------------------------
    op.create_table(
        "alignment_assignments",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("alignment_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("event_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("member_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("role", sa.String(10), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("alignment_id", "event_id", "member_id"),
        sa.ForeignKeyConstraint(["alignment_id"], ["alignments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["member_id"], ["members.id"], ondelete="CASCADE"),
    )
    op.create_index("idx_alignment_assignments_event", "alignment_assignments", ["event_id"])
    op.create_index("idx_alignment_assignments_member", "alignment_assignments", ["member_id"])

    # ------------------------------------------------------------------
    # show_plans — FK to events, members
    # ------------------------------------------------------------------
    op.create_table(
        "show_plans",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("event_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("show_type", sa.String(30), nullable=False),
        sa.Column("theme", sa.String(200), nullable=True),
        sa.Column("duration", sa.String(10), nullable=True),
        sa.Column("venue_name", sa.String(200), nullable=True),
        sa.Column("venue_contact", sa.String(200), nullable=True),
        sa.Column("config", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("generated_plan", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"]),
        sa.ForeignKeyConstraint(["created_by"], ["members.id"]),
    )
    op.create_index("idx_show_plans_event", "show_plans", ["event_id"])


def downgrade() -> None:
    op.drop_index("idx_show_plans_event", table_name="show_plans")
    op.drop_table("show_plans")
    op.drop_index("idx_alignment_assignments_member", table_name="alignment_assignments")
    op.drop_index("idx_alignment_assignments_event", table_name="alignment_assignments")
    op.drop_table("alignment_assignments")
    op.drop_table("alignment_events")
    op.drop_table("alignments")
    op.drop_index("idx_events_type", table_name="events")
    op.drop_index("idx_events_start", table_name="events")
    op.drop_index("idx_events_season", table_name="events")
    op.drop_table("events")
    op.drop_table("member_commissions")
    op.drop_table("member_seasons")
    op.drop_table("commissions")
    op.drop_table("venues")
    op.drop_table("seasons")
    op.drop_table("members")
