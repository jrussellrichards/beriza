"""agrega mandante_id a requisitos_documentales (requisitos propios)

Permite que un mandante_admin cree requisitos documentales propios,
visibles solo para su organizacion, reutilizando el mismo CRUD del
catalogo global (antes exclusivo de berisa_admin). NULL = catalogo
global; con valor = propio de ese mandante.

La unicidad de "codigo" pasa de global a: unica entre los globales
(mandante_id IS NULL) y unica por mandante (mandante_id, codigo) entre
los propios -- dos mandantes distintos pueden usar el mismo codigo.

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-07-23

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'f6a7b8c9d0e1'
down_revision: Union[str, None] = 'e5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('requisitos_documentales', sa.Column('mandante_id', sa.Uuid(), nullable=True))
    op.create_foreign_key(
        'fk_requisitos_documentales_mandante_id', 'requisitos_documentales',
        'mandantes', ['mandante_id'], ['id'],
    )

    op.drop_constraint('requisitos_documentales_codigo_key', 'requisitos_documentales', type_='unique')
    op.create_index(
        'uq_requisitos_documentales_codigo_global', 'requisitos_documentales', ['codigo'],
        unique=True, postgresql_where=sa.text('mandante_id IS NULL'),
    )
    op.create_index(
        'uq_requisitos_documentales_codigo_por_mandante', 'requisitos_documentales',
        ['mandante_id', 'codigo'], unique=True, postgresql_where=sa.text('mandante_id IS NOT NULL'),
    )


def downgrade() -> None:
    op.drop_index('uq_requisitos_documentales_codigo_por_mandante', table_name='requisitos_documentales')
    op.drop_index('uq_requisitos_documentales_codigo_global', table_name='requisitos_documentales')
    op.create_unique_constraint('requisitos_documentales_codigo_key', 'requisitos_documentales', ['codigo'])
    op.drop_constraint('fk_requisitos_documentales_mandante_id', 'requisitos_documentales', type_='foreignkey')
    op.drop_column('requisitos_documentales', 'mandante_id')
