"""add feedbacks table

Revision ID: 20260513_0100
Revises: 20260512_1200
Create Date: 2026-05-13 01:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260513_0100"
down_revision = "20260512_1200"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "feedbacks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("reporter_name", sa.String(200), nullable=True),
        sa.Column(
            "reporter_member_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("members.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_feedbacks_created_at", "feedbacks", ["created_at"])


def downgrade() -> None:
    op.drop_index("idx_feedbacks_created_at", table_name="feedbacks")
    op.drop_table("feedbacks")
