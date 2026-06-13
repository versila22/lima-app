"""add events.facebook_url + events.ticketing_url

Revision ID: 20260613_0200
Revises: 20260613_0100
Create Date: 2026-06-13 02:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = "20260613_0200"
down_revision = "20260613_0100"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("events", sa.Column("facebook_url", sa.String(length=500), nullable=True))
    op.add_column("events", sa.Column("ticketing_url", sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column("events", "ticketing_url")
    op.drop_column("events", "facebook_url")
