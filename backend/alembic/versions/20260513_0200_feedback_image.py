"""add image_data_url column to feedbacks

Revision ID: 20260513_0200
Revises: 20260513_0100
Create Date: 2026-05-13 02:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "20260513_0200"
down_revision = "20260513_0100"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "feedbacks",
        sa.Column("image_data_url", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("feedbacks", "image_data_url")
