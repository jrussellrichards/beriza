"""Bitacora del servicio: quien le cambio el estado, lo archivo o lo reactivo

Observacion #1c del feedback del 25 de agosto de 2026: un servicio TERMINADO no
se podia reactivar nunca. La unica salida era crear uno nuevo desde cero,
perdiendo el historial de acreditacion del anterior.

Reactivar reabre un contrato cerrado, y esa es exactamente la clase de accion por
la que alguien pregunta seis meses despues. Los documentos tenian bitacora desde
el principio (acreditacion_eventos); el servicio no dejaba rastro de nada.

Revision ID: a2b3c4d5e6f8
Revises: f1a2b3c4d5e7
"""
from alembic import op
import sqlalchemy as sa

revision = "a2b3c4d5e6f8"
down_revision = "f1a2b3c4d5e7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "servicio_eventos",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("servicio_id", sa.Uuid(), nullable=False),
        sa.Column("tipo_evento", sa.String(40), nullable=False),
        sa.Column("estado_anterior", sa.String(20), nullable=True),
        sa.Column("estado_nuevo", sa.String(20), nullable=True),
        sa.Column("actor_usuario_id", sa.Uuid(), nullable=True),
        sa.Column("motivo", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["servicio_id"], ["servicios.id"]),
        sa.ForeignKeyConstraint(["actor_usuario_id"], ["usuarios.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_servicio_eventos_servicio_id", "servicio_eventos", ["servicio_id"])


def downgrade() -> None:
    op.drop_index("ix_servicio_eventos_servicio_id", table_name="servicio_eventos")
    op.drop_table("servicio_eventos")
