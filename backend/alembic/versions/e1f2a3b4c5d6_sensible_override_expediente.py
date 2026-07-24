"""sensible_override en expediente: el contratista pisa el default del catalogo

Revision ID: e1f2a3b4c5d6
Revises: d0e1f2a3b4c5
Create Date: 2026-07-24

NULL = usar RequisitoDocumental.sensible (default de BERISA/mandante).
True = endurecer. False = relajar, solo valido en documentos de entidad EMPRESA
(el dominio lo hace cumplir; ver reutilizacion_service.es_sensible).
"""
from alembic import op
import sqlalchemy as sa

revision = "e1f2a3b4c5d6"
down_revision = "d0e1f2a3b4c5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "expedientes",
        sa.Column("sensible_override", sa.Boolean(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("expedientes", "sensible_override")
