"""Archivar un servicio: sacarlo de la lista sin perder su historial

Observacion #1b del feedback del 25 de agosto de 2026: "no permite eliminar
servicios". Un servicio con acreditaciones no se puede borrar —destruiria el
rastro que hace defendible la acreditacion ante una fiscalizacion—, asi que se
archiva.

archivado_en es una COLUMNA y no un cuarto EstadoServicio a proposito. Ver el
comentario en app/models/servicio.py: como estado, archivar un contrato
TERMINADO seria imposible, pisaria el hecho de que termino, y podria sacar el
servicio de la evaluacion llevando al contratista de BLOQUEADA a ACREDITADA sin
que nadie suba un documento.

El indice unico del codigo de referencia pasa a excluir los archivados: un
servicio archivado ya no ocupa su numero de contrato, y el bueno tiene que poder
reusarlo.

Revision ID: f1a2b3c4d5e7
Revises: e5f6a7b8c2d3
"""
from alembic import op
import sqlalchemy as sa

revision = "f1a2b3c4d5e7"
down_revision = "e5f6a7b8c2d3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("servicios", sa.Column("archivado_en", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "servicios",
        sa.Column("archivado_por_usuario_id", sa.Uuid(), nullable=True),
    )
    op.create_foreign_key(
        "fk_servicios_archivado_por_usuario",
        "servicios", "usuarios",
        ["archivado_por_usuario_id"], ["id"],
    )
    op.create_index("ix_servicios_archivado_en", "servicios", ["archivado_en"])

    # El indice parcial se recrea con la condicion nueva. Es PostgreSQL-only
    # (postgresql_where), asi que CI lo ejercita pero la suite sobre SQLite no
    # puede verificarlo: si queda mal, se descubre al reusar un codigo.
    op.drop_index("uq_servicio_codigo_referencia", table_name="servicios")
    op.create_index(
        "uq_servicio_codigo_referencia",
        "servicios",
        ["contratista_mandante_id", "codigo_referencia"],
        unique=True,
        postgresql_where=sa.text("codigo_referencia IS NOT NULL AND archivado_en IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_servicio_codigo_referencia", table_name="servicios")
    op.create_index(
        "uq_servicio_codigo_referencia",
        "servicios",
        ["contratista_mandante_id", "codigo_referencia"],
        unique=True,
        postgresql_where=sa.text("codigo_referencia IS NOT NULL"),
    )
    op.drop_index("ix_servicios_archivado_en", table_name="servicios")
    op.drop_constraint("fk_servicios_archivado_por_usuario", "servicios", type_="foreignkey")
    op.drop_column("servicios", "archivado_por_usuario_id")
    op.drop_column("servicios", "archivado_en")
