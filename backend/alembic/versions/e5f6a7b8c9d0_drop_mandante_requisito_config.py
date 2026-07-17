"""elimina mandante_requisito_config (reemplazada por perfil_requisito_config)

La configuración de requisitos vive desde la Fase 1 en
PerfilRequisitos/PerfilRequisitoConfig, anclada a los servicios. La migración
c3d4e5f6a7b8 ya copió todas las filas al perfil "General" de cada mandante;
esta migración solo elimina la tabla deprecada una vez que backend y
frontend dejaron de leerla (Fase 4).

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-07-14

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_table('mandante_requisito_config')


def downgrade() -> None:
    op.create_table('mandante_requisito_config',
        sa.Column('mandante_id', sa.Uuid(), nullable=False),
        sa.Column('requisito_documental_id', sa.Uuid(), nullable=False),
        sa.Column('es_obligatorio', sa.Boolean(), nullable=False),
        sa.Column('vigencia_max_dias', sa.Integer(), nullable=False),
        sa.Column('umbral_deuda_max', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['mandante_id'], ['mandantes.id'], ),
        sa.ForeignKeyConstraint(['requisito_documental_id'], ['requisitos_documentales.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    # Restaurar datos desde el perfil "General" de cada mandante
    op.execute("""
        INSERT INTO mandante_requisito_config
            (id, mandante_id, requisito_documental_id, es_obligatorio,
             vigencia_max_dias, umbral_deuda_max, created_at, updated_at)
        SELECT gen_random_uuid(), p.mandante_id, c.requisito_documental_id,
               c.es_obligatorio, c.vigencia_max_dias, c.umbral_deuda_max, now(), now()
        FROM perfil_requisito_config c
        JOIN perfiles_requisitos p ON p.id = c.perfil_id AND p.nombre = 'General'
    """)
