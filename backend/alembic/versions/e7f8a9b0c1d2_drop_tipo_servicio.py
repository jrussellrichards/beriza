"""se elimina el tipo de servicio (obra / faena / servicio)

Revision ID: e7f8a9b0c1d2
Revises: d6e7f8a9b0c1
Create Date: 2026-07-27

La migracion anterior dejo la columna nullable para no perder la palabra que
los servicios existentes ya tenian. Confirmado que todos esos datos son de
prueba, se elimina: el centro de trabajo dice donde se ejecuta el servicio, que
es lo unico que obra/faena/servicio aportaba.

DESTRUCTIVA: el downgrade recrea la columna vacia. Los valores no se pueden
recuperar; si alguna vez hicieran falta, tendrian que volver a capturarse.
"""
from alembic import op
import sqlalchemy as sa

revision = "e7f8a9b0c1d2"
down_revision = "d6e7f8a9b0c1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("servicios", "tipo")


def downgrade() -> None:
    # Nullable a proposito: no hay valores que restituir, y volver al NOT NULL
    # original obligaria a inventar un "SERVICIO" para cada fila.
    op.add_column("servicios", sa.Column("tipo", sa.String(length=20), nullable=True))
