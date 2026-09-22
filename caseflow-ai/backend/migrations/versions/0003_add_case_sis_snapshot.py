"""Store the submitted SIS comparison snapshot with each case."""
from alembic import op
import sqlalchemy as sa

revision = "0003_add_case_sis_snapshot"
down_revision = "0002_unicode_content"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("Cases", sa.Column("sis_amount", sa.Numeric(18, 2), nullable=True))
    op.add_column("Cases", sa.Column("sis_status", sa.String(50), nullable=True))


def downgrade():
    op.drop_column("Cases", "sis_status")
    op.drop_column("Cases", "sis_amount")
