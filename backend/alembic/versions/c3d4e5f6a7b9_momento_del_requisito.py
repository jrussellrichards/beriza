"""cuando se exige cada requisito dentro de la vida del servicio

Revision ID: c3d4e5f6a7b9
Revises: b7c8d9e0f1a2
Create Date: 2026-08-18

Hasta ahora todo se exigia desde el dia cero del servicio, incluidos documentos
que en el dia cero NO PUEDEN EXISTIR: el F30-1 del mes anterior de una obra que
parte hoy, las liquidaciones del mes en curso, el registro de asistencia. El
contratista figuraba incompleto por no entregar algo imposible y el mandante veia
una brecha que no lo era.

El campo va en perfil_requisito_config y no en el catalogo global porque es
decision de cada mandante: el mismo F30 puede ser de arranque para un cliente y
mensual para otro.

ARRANQUE por defecto — es exactamente el comportamiento anterior, asi que ningun
perfil ya configurado cambia de resultado al aplicar esta migracion.
"""
from alembic import op
import sqlalchemy as sa

revision = "c3d4e5f6a7b9"
down_revision = "b7c8d9e0f1a2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "perfil_requisito_config",
        sa.Column("momento", sa.String(length=20), nullable=False,
                  server_default="ARRANQUE"),
    )


def downgrade() -> None:
    op.drop_column("perfil_requisito_config", "momento")
