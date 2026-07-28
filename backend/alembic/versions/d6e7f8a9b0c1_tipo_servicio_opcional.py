"""tipo de servicio deja de ser obligatorio

Revision ID: d6e7f8a9b0c1
Revises: c5d6e7f8a9b0
Create Date: 2026-07-27

Obra / faena / servicio se preguntaba al crear el servicio para saber DONDE se
ejecutaba. Ahora eso lo dice el centro de trabajo, que es una entidad con
direccion y encargado, asi que la pregunta quedo sin proposito y se saca del
formulario.

La columna NO se borra: los servicios que ya existen tienen una palabra que el
mandante eligio de verdad y el portal del contratista la sigue mostrando.
Pasa a nullable para que los nuevos queden en null en vez de guardar un
"SERVICIO" que nadie eligio y que la UI presentaria como si si.
"""
from alembic import op
import sqlalchemy as sa

revision = "d6e7f8a9b0c1"
down_revision = "c5d6e7f8a9b0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("servicios", "tipo",
                    existing_type=sa.String(length=20),
                    nullable=True,
                    server_default=None)


def downgrade() -> None:
    # Volver a NOT NULL exige rellenar los que quedaron sin tipo. Se usa
    # SERVICIO, que es el default que tenia la columna antes.
    op.execute("UPDATE servicios SET tipo = 'SERVICIO' WHERE tipo IS NULL")
    op.alter_column("servicios", "tipo",
                    existing_type=sa.String(length=20),
                    nullable=False,
                    server_default="SERVICIO")
