"""tipo en servicio: obra / faena / servicio

Revision ID: f2a3b4c5d6e7
Revises: e1f2a3b4c5d6
Create Date: 2026-07-24

Vocabulario del rubro. No son intercambiables: una obra se construye y termina,
una faena es un sitio de trabajo continuo, un servicio es una prestacion que
puede no tener sitio fijo. Default SERVICIO para las filas existentes.
"""
from alembic import op
import sqlalchemy as sa

revision = "f2a3b4c5d6e7"
down_revision = "e1f2a3b4c5d6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("servicios", sa.Column(
        "tipo", sa.String(length=20), nullable=False, server_default="SERVICIO"))


def downgrade() -> None:
    op.drop_column("servicios", "tipo")
