"""add alignments.is_auto + backfill MJ_MC role to MJ

Revision ID: 20260613_0100
Revises: 20260612_0100
Create Date: 2026-06-13 01:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = "20260613_0100"
down_revision = "20260612_0100"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "alignments",
        sa.Column(
            "is_auto",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.execute("UPDATE alignment_assignments SET role = 'MJ' WHERE role = 'MJ_MC'")


def downgrade() -> None:
    op.execute("UPDATE alignment_assignments SET role = 'MJ_MC' WHERE role = 'MJ'")
    op.drop_column("alignments", "is_auto")
