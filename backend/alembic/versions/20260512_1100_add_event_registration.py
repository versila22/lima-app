"""add allow_registration to events and create event_registrations table

Revision ID: 20260512_1100
Revises: 20260512_1000
Create Date: 2026-05-12 11:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260512_1100"
down_revision = "20260512_1000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("events", sa.Column("allow_registration", sa.Boolean(), nullable=False, server_default="false"))

    op.create_table(
        "event_registrations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("event_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("events.id", ondelete="CASCADE"), nullable=False),
        sa.Column("member_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("members.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("event_id", "member_id", name="uq_event_member_registration"),
    )
    op.create_index("idx_event_registrations_event", "event_registrations", ["event_id"])
    op.create_index("idx_event_registrations_member", "event_registrations", ["member_id"])


def downgrade() -> None:
    op.drop_index("idx_event_registrations_member", table_name="event_registrations")
    op.drop_index("idx_event_registrations_event", table_name="event_registrations")
    op.drop_table("event_registrations")
    op.drop_column("events", "allow_registration")
