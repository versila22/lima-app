"""email_logs table + members.email_reminders_enabled

Revision ID: 20260612_0100
Revises: 20260513_0300
Create Date: 2026-06-12 01:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260612_0100"
down_revision = "20260513_0300"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "members",
        sa.Column(
            "email_reminders_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )
    op.create_table(
        "email_logs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "member_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("members.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "event_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("events.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "alignment_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("alignments.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column(
            "sent_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_unique_constraint(
        "uq_email_logs_member_event_kind",
        "email_logs",
        ["member_id", "event_id", "kind"],
    )
    op.create_index("ix_email_logs_sent_at", "email_logs", ["sent_at"])


def downgrade() -> None:
    op.drop_index("ix_email_logs_sent_at", table_name="email_logs")
    op.drop_constraint("uq_email_logs_member_event_kind", "email_logs", type_="unique")
    op.drop_table("email_logs")
    op.drop_column("members", "email_reminders_enabled")
