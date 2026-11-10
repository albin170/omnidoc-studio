"""add_individual_plan_tier_to_users

Revision ID: c92b84f1902e
Revises: b81a73f0891d
Create Date: 2026-11-10 17:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c92b84f1902e'
down_revision: Union[str, None] = 'b81a73f0891d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('individual_plan_tier', sa.String(length=32), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'individual_plan_tier')
