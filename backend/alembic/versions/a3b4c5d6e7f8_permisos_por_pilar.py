"""permisos de aprobacion por pilar

Revision ID: a3b4c5d6e7f8
Revises: f2a3b4c5d6e7
Create Date: 2026-07-25

Que pilares puede APROBAR un usuario del mandante. mandante_admin no necesita
filas: aprueba cualquiera. Ver no se restringe (ver el docstring del modelo).
"""
from alembic import op
import sqlalchemy as sa

revision = "a3b4c5d6e7f8"
down_revision = "f2a3b4c5d6e7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "usuario_pilar_permisos",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("usuario_id", sa.UUID(), sa.ForeignKey("usuarios.id"), nullable=False),
        sa.Column("pilar_id", sa.UUID(), sa.ForeignKey("pilares.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("usuario_id", "pilar_id", name="uq_usuario_pilar"),
    )
    op.create_index("ix_usuario_pilar_permisos_usuario_id", "usuario_pilar_permisos", ["usuario_id"])


def downgrade() -> None:
    op.drop_index("ix_usuario_pilar_permisos_usuario_id", table_name="usuario_pilar_permisos")
    op.drop_table("usuario_pilar_permisos")
