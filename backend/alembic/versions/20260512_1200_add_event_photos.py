"""add event_photos table

Revision ID: 20260512_1200
Revises: 20260512_1100
Create Date: 2026-05-12 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260512_1200"
down_revision = "20260512_1100"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "event_photos",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("event_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("events.id", ondelete="CASCADE"), nullable=False),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("s3_key", sa.String(500), nullable=True),
        sa.Column("caption", sa.String(200), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_event_photos_event", "event_photos", ["event_id"])


def downgrade() -> None:
    op.drop_index("idx_event_photos_event", table_name="event_photos")
    op.drop_table("event_photos")
