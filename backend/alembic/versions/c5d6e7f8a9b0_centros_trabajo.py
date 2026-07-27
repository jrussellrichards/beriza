"""centros de trabajo: el lugar fisico donde se ejecuta el servicio

Revision ID: c5d6e7f8a9b0
Revises: b4c5d6e7f8a9
Create Date: 2026-07-26

Antes "faena" era una etiqueta sobre el contrato de UN contratista
(`Servicio.tipo`). Con cinco contratistas en Chuquicamata habia cinco contratos
sueltos y ninguna forma de preguntar por Chuquicamata como lugar.

El centro cuelga del MANDANTE, y el vinculo con el contratista es indirecto, a
traves de sus servicios. Es la correccion al arbol
`Mandante -> Centro -> Contratista -> Servicio`: leido literal ese arbol dice que
un contratista pertenece a una faena, y un transportista sirve a varias del mismo
mandante a la vez.

Migracion ADITIVA: una tabla nueva y una columna nullable. No se borra ni
reestructura nada, y los servicios existentes siguen funcionando sin centro.
"""
from alembic import op
import sqlalchemy as sa

revision = "c5d6e7f8a9b0"
down_revision = "b4c5d6e7f8a9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "centros_trabajo",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("mandante_id", sa.UUID(), sa.ForeignKey("mandantes.id"), nullable=False),
        sa.Column("nombre", sa.String(255), nullable=False),
        sa.Column("direccion", sa.Text(), nullable=True),
        # Nullable: el cargo queda vacante cuando la persona renuncia, y exigirlo
        # impediria darla de baja. El endpoint de creacion si lo pide.
        sa.Column("encargado_id", sa.UUID(), sa.ForeignKey("usuarios.id"), nullable=True),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        # Dos faenas con el mismo nombre en un mandante son casi siempre un
        # duplicado por tipeo, y confunden al elegir en el selector.
        sa.UniqueConstraint("mandante_id", "nombre", name="uq_centro_mandante_nombre"),
    )
    op.create_index("ix_centros_trabajo_mandante_id", "centros_trabajo", ["mandante_id"])
    op.create_index("ix_centros_trabajo_encargado_id", "centros_trabajo", ["encargado_id"])

    op.add_column(
        "servicios",
        sa.Column("centro_trabajo_id", sa.UUID(), sa.ForeignKey("centros_trabajo.id"), nullable=True),
    )
    op.create_index("ix_servicios_centro_trabajo_id", "servicios", ["centro_trabajo_id"])


def downgrade() -> None:
    op.drop_index("ix_servicios_centro_trabajo_id", table_name="servicios")
    op.drop_column("servicios", "centro_trabajo_id")
    op.drop_index("ix_centros_trabajo_encargado_id", table_name="centros_trabajo")
    op.drop_index("ix_centros_trabajo_mandante_id", table_name="centros_trabajo")
    op.drop_table("centros_trabajo")
