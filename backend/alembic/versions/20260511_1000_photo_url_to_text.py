"""photo_url column to Text for base64 data URIs

Revision ID: 20260511_1000
Revises: 20260408_0220
Create Date: 2026-05-11 10:00:00
"""
from alembic import op
import sqlalchemy as sa

revision = '20260511_1000'
down_revision = '20260408_0220'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column('members', 'photo_url',
                    existing_type=sa.String(500),
                    type_=sa.Text(),
                    existing_nullable=True)


def downgrade() -> None:
    op.alter_column('members', 'photo_url',
                    existing_type=sa.Text(),
                    type_=sa.String(500),
                    existing_nullable=True)
