"""add_token_version_to_users

Revision ID: b81a73f0891d
Revises: 578e51f364e3
Create Date: 2026-11-10 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b81a73f0891d'
down_revision: Union[str, None] = '578e51f364e3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('token_version', sa.Integer(), nullable=False, server_default='1'))


def downgrade() -> None:
    op.drop_column('users', 'token_version')
