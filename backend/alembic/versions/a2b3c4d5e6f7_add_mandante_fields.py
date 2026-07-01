"""add mandante fields

Revision ID: a2b3c4d5e6f7
Revises: d67a81945b7e
Create Date: 2026-06-29

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'a2b3c4d5e6f7'
down_revision: Union[str, None] = 'd67a81945b7e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('mandantes', sa.Column('email_contacto', sa.String(255), nullable=True))
    op.add_column('mandantes', sa.Column('sitio_web', sa.String(255), nullable=True))
    op.add_column('mandantes', sa.Column('plan', sa.String(50), nullable=False, server_default='Pro'))


def downgrade() -> None:
    op.drop_column('mandantes', 'plan')
    op.drop_column('mandantes', 'sitio_web')
    op.drop_column('mandantes', 'email_contacto')
