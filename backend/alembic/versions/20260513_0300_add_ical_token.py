"""add ical_token to members

Revision ID: 20260513_0300
Revises: 20260513_0200
Create Date: 2026-05-13 03:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "20260513_0300"
down_revision = "20260513_0200"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "members",
        sa.Column("ical_token", sa.String(64), nullable=True),
    )
    op.create_unique_constraint("uq_members_ical_token", "members", ["ical_token"])


def downgrade() -> None:
    op.drop_constraint("uq_members_ical_token", "members", type_="unique")
    op.drop_column("members", "ical_token")
