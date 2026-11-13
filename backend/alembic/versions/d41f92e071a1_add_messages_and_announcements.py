"""add_messages_and_announcements

Revision ID: d41f92e071a1
Revises: c92b84f1902e
Create Date: 2026-11-13 18:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd41f92e071a1'
down_revision: Union[str, None] = 'c92b84f1902e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. messages table
    op.create_table(
        'messages',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('sender_user_id', sa.String(length=36), nullable=False),
        sa.Column('recipient_user_id', sa.String(length=36), nullable=False),
        sa.Column('subject', sa.String(length=255), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('priority', sa.String(length=32), nullable=False, server_default='normal'),
        sa.Column('status', sa.String(length=32), nullable=False, server_default='sent'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('read_at', sa.DateTime(), nullable=True),
        sa.Column('archived_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['recipient_user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['sender_user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_messages_created_at', 'messages', ['created_at'])
    op.create_index('ix_messages_recipient_user_id', 'messages', ['recipient_user_id'])
    op.create_index('ix_messages_sender_user_id', 'messages', ['sender_user_id'])
    op.create_index('ix_messages_recipient_created', 'messages', ['recipient_user_id', 'created_at'])
    op.create_index('ix_messages_recipient_status', 'messages', ['recipient_user_id', 'status'])

    # 2. announcements table
    op.create_table(
        'announcements',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('priority', sa.String(length=32), nullable=False, server_default='informational'),
        sa.Column('audience_type', sa.String(length=32), nullable=False, server_default='all'),
        sa.Column('audience_reference', sa.String(length=128), nullable=True),
        sa.Column('created_by', sa.String(length=36), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('published_at', sa.DateTime(), nullable=True),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.Column('is_published', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('is_archived', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_announcements_created_at', 'announcements', ['created_at'])
    op.create_index('ix_announcements_is_archived', 'announcements', ['is_archived'])
    op.create_index('ix_announcements_is_published', 'announcements', ['is_published'])
    op.create_index('ix_announcements_published_active', 'announcements', ['is_published', 'is_archived', 'expires_at'])

    # 3. announcement_reads table
    op.create_table(
        'announcement_reads',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('announcement_id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('read_at', sa.DateTime(), nullable=False),
        sa.Column('dismissed_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['announcement_id'], ['announcements.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_announcement_reads_announcement_id', 'announcement_reads', ['announcement_id'])
    op.create_index('ix_announcement_reads_user_id', 'announcement_reads', ['user_id'])
    op.create_index('ix_announcement_reads_user_announcement', 'announcement_reads', ['user_id', 'announcement_id'], unique=True)


def downgrade() -> None:
    op.drop_table('announcement_reads')
    op.drop_table('announcements')
    op.drop_table('messages')
