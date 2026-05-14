"""add match_report to events

Revision ID: 20260512_1000
Revises: 20260511_1000_photo_url_to_text
Create Date: 2026-05-12 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = "20260512_1000"
down_revision = "20260511_1000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("events", sa.Column("match_report", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("events", "match_report")
