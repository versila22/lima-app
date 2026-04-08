"""add photo_url to members

Revision ID: 20260408_0220
Revises: 20260406_2230
Create Date: 2026-04-08 02:20:00
"""
from alembic import op
import sqlalchemy as sa

revision = '20260408_0220'
down_revision = '20260406_2230'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('members', sa.Column('photo_url', sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column('members', 'photo_url')
