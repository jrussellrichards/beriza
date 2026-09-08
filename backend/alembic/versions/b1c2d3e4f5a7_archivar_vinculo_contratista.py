"""Archivar el vinculo con un contratista: sacarlo de la lista sin perder el rastro

Un mandante podia invitar a una empresa contratista pero nunca sacarla: si
invitaba a la equivocada, o si la relacion comercial terminaba, la empresa
quedaba en su lista para siempre. No existia ni endpoint ni pantalla.

Se resuelve igual que con los servicios, y por la misma razon:

  - BORRADO real solo si el vinculo no dejo rastro (ni servicios ni
    acreditaciones). Es el caso de la invitacion equivocada, donde no hay nada
    que proteger.
  - ARCHIVADO para el resto: sale de la lista y conserva todo. Borrar un vinculo
    con acreditaciones destruiria el registro de que se le exigio a esa empresa
    y que entrego, que es lo que hace defendible la acreditacion ante una
    fiscalizacion.

`archivado_en` es una COLUMNA y no un quinto `estado_acreditacion`, con una
razon mas fuerte que en Servicio: ese campo no es administrativo, lo CALCULA y
lo escribe acreditacion_service, asi que un valor "ARCHIVADA" puesto a mano lo
pisaria la siguiente evaluacion.

Lo que hace seguro archivar es la invariante de vinculo_service.archivar: solo
se archiva un vinculo SIN servicios activos. `evaluar_relacion` retorna temprano
cuando no hay servicios activos, de modo que archivar no puede mover ningun
numero derivado.

Aditiva y sin backfill: todos los vinculos existentes quedan con archivado_en
NULL, que es "visible", el comportamiento de siempre.

Revision ID: b1c2d3e4f5a7
Revises: a2b3c4d5e6f8
"""
from alembic import op
import sqlalchemy as sa

revision = "b1c2d3e4f5a7"
down_revision = "a2b3c4d5e6f8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "contratistas_mandantes",
        sa.Column("archivado_en", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "contratistas_mandantes",
        sa.Column("archivado_por_usuario_id", sa.Uuid(), nullable=True),
    )
    op.create_foreign_key(
        "fk_contratistas_mandantes_archivado_por_usuario",
        "contratistas_mandantes", "usuarios",
        ["archivado_por_usuario_id"], ["id"],
    )
    op.create_index(
        "ix_contratistas_mandantes_archivado_en",
        "contratistas_mandantes", ["archivado_en"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_contratistas_mandantes_archivado_en", table_name="contratistas_mandantes"
    )
    op.drop_constraint(
        "fk_contratistas_mandantes_archivado_por_usuario",
        "contratistas_mandantes", type_="foreignkey",
    )
    op.drop_column("contratistas_mandantes", "archivado_por_usuario_id")
    op.drop_column("contratistas_mandantes", "archivado_en")
