"""agrega sin_vencimiento a requisitos_documentales (Fase 2)

Flag por tipo de documento: si True, sus documentos no caducan y el cron de
vencimientos los ignora (ej. certificado de constitucion de sociedad).

Revision ID: c9d0e1f2a3b4
Revises: b8c9d0e1f2a3
Create Date: 2026-07-24

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'c9d0e1f2a3b4'
down_revision: Union[str, None] = 'b8c9d0e1f2a3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'requisitos_documentales',
        sa.Column('sin_vencimiento', sa.Boolean(), nullable=False, server_default='false'),
    )


def downgrade() -> None:
    op.drop_column('requisitos_documentales', 'sin_vencimiento')
