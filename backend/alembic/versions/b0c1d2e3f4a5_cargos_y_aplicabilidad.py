"""cargos y aplicabilidad de requisitos por cargo

Revision ID: b0c1d2e3f4a5
Revises: a9b0c1d2e3f4
Create Date: 2026-08-06

El modelo no podia expresar "esto se le pide al conductor y no a la secretaria":
todo requisito de entidad_tipo=TRABAJADOR aplicaba identico a la dotacion
completa. Trabajador.cargo era texto libre y no participaba de ninguna regla.

Tres piezas:

1. `cargos` — catalogo. mandante_id NULL = global de BERISA, con valor = propio
   del mandante. Mismo patron que requisitos_documentales, incluido el indice
   parcial para la unicidad del codigo global (Postgres considera distintos dos
   NULL, asi que el UNIQUE ordinario no alcanza).

2. `servicio_trabajadores.cargo_id` — el cargo va en la ASIGNACION, no en la
   persona: la misma persona puede ser operador en un servicio y administrativo
   en otro.

3. `perfil_requisito_cargo` — a que cargos aplica un requisito dentro del perfil.
   SIN filas = aplica a todos, que es el comportamiento actual.

ADITIVA Y SIN CAMBIO DE COMPORTAMIENTO: las dos tablas nacen vacias y cargo_id
nace NULL, asi que el sistema evalua exactamente igual que antes hasta que
alguien configure algo. No hay backfill y no hay que migrar datos.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "b0c1d2e3f4a5"
down_revision = "a9b0c1d2e3f4"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "cargos",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("mandante_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("mandantes.id"), nullable=True),
        sa.Column("codigo", sa.String(50), nullable=False),
        sa.Column("nombre", sa.String(255), nullable=False),
        sa.Column("area", sa.String(120), nullable=True),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default="true"),
        sa.UniqueConstraint("mandante_id", "codigo", name="uq_cargo_codigo_mandante"),
    )
    op.create_index("ix_cargos_mandante_id", "cargos", ["mandante_id"])
    op.create_index(
        "uq_cargo_codigo_global", "cargos", ["codigo"],
        unique=True, postgresql_where=sa.text("mandante_id IS NULL"),
    )

    op.add_column(
        "servicio_trabajadores",
        sa.Column("cargo_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("cargos.id"), nullable=True),
    )
    op.create_index("ix_servicio_trabajadores_cargo_id", "servicio_trabajadores", ["cargo_id"])

    op.create_table(
        "perfil_requisito_cargo",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "perfil_requisito_config_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("perfil_requisito_config.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("cargo_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("cargos.id"), nullable=False),
        sa.UniqueConstraint("perfil_requisito_config_id", "cargo_id", name="uq_perfil_req_cargo"),
    )
    op.create_index(
        "ix_perfil_requisito_cargo_config", "perfil_requisito_cargo", ["perfil_requisito_config_id"]
    )
    op.create_index("ix_perfil_requisito_cargo_cargo", "perfil_requisito_cargo", ["cargo_id"])


def downgrade():
    op.drop_table("perfil_requisito_cargo")
    op.drop_index("ix_servicio_trabajadores_cargo_id", table_name="servicio_trabajadores")
    op.drop_column("servicio_trabajadores", "cargo_id")
    op.drop_index("uq_cargo_codigo_global", table_name="cargos")
    op.drop_table("cargos")
