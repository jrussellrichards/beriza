"""agrega sensible a requisitos_documentales (Fase 2 — reutilizacion)

Flag por tipo de documento: si True, el documento no se comparte con un mandante
nuevo automaticamente — requiere autorizacion explicita del contratista.

Revision ID: d0e1f2a3b4c5
Revises: c9d0e1f2a3b4
Create Date: 2026-07-24

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'd0e1f2a3b4c5'
down_revision: Union[str, None] = 'c9d0e1f2a3b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'requisitos_documentales',
        sa.Column('sensible', sa.Boolean(), nullable=False, server_default='false'),
    )


def downgrade() -> None:
    op.drop_column('requisitos_documentales', 'sensible')
