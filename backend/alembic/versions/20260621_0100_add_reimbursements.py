"""add reimbursements + reimbursement_attachments

Revision ID: 20260621_0100
Revises: 20260613_0200
Create Date: 2026-06-21 01:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260621_0100"
down_revision = "20260613_0200"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "reimbursements",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("first_name", sa.String(120), nullable=False),
        sa.Column("last_name", sa.String(120), nullable=False),
        sa.Column("purchase_description", sa.Text(), nullable=False),
        sa.Column("store", sa.String(200), nullable=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("direct_expenses_eur", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("funds_source", sa.String(20), nullable=False, server_default="own"),
        sa.Column("km_distance", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("km_rate_eur", sa.Numeric(6, 3), nullable=False, server_default="0.32"),
        sa.Column("km_amount_eur", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("trip_description", sa.String(300), nullable=True),
        sa.Column("toll_eur", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("total_eur", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("status", sa.String(30), nullable=False, server_default="awaiting_confirmation"),
        sa.Column("confirm_deadline", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finalized_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("submitter_member_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("members.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_reimbursements_created_at", "reimbursements", ["created_at"])
    op.create_index("idx_reimbursements_status", "reimbursements", ["status"])

    op.create_table(
        "reimbursement_attachments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("reimbursement_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("reimbursements.id", ondelete="CASCADE"), nullable=False),
        sa.Column("url", sa.String(600), nullable=False),
        sa.Column("s3_key", sa.String(400), nullable=False),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("content_type", sa.String(120), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("reimbursement_attachments")
    op.drop_index("idx_reimbursements_status", table_name="reimbursements")
    op.drop_index("idx_reimbursements_created_at", table_name="reimbursements")
    op.drop_table("reimbursements")
