"""Datos del contratista que el mandante necesita en una fiscalizacion

Observacion #3 del feedback del 25 de agosto de 2026: EmpresaContratista tenia
exactamente tres campos —rut, razon_social y giro—, y en una fiscalizacion de la
Direccion del Trabajo o la SUSESO el mandante no tenia de donde sacar a quien
llamar ni a que mutualidad esta afiliada la empresa.

Todas las columnas nacen NULL y sin server_default: las empresas ya existentes se
dieron de alta con RUT y razon social, y ponerles un valor inventado seria peor
que dejarlas vacias — un dato falso en una fiscalizacion es peor que ninguno.

Revision ID: d4e5f6a7b8c1
Revises: c3d4e5f6a7b9
"""
from alembic import op
import sqlalchemy as sa

revision = "d4e5f6a7b8c1"
down_revision = "c3d4e5f6a7b9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("empresas_contratistas", sa.Column("mutualidad", sa.String(20), nullable=True))
    op.add_column("empresas_contratistas", sa.Column("direccion", sa.Text(), nullable=True))
    op.add_column("empresas_contratistas", sa.Column("telefono_emergencia", sa.String(50), nullable=True))
    op.add_column("empresas_contratistas", sa.Column("representante_legal_nombre", sa.String(255), nullable=True))
    op.add_column("empresas_contratistas", sa.Column("representante_legal_rut", sa.String(12), nullable=True))
    op.add_column("empresas_contratistas", sa.Column("representante_legal_telefono", sa.String(50), nullable=True))


def downgrade() -> None:
    op.drop_column("empresas_contratistas", "representante_legal_telefono")
    op.drop_column("empresas_contratistas", "representante_legal_rut")
    op.drop_column("empresas_contratistas", "representante_legal_nombre")
    op.drop_column("empresas_contratistas", "telefono_emergencia")
    op.drop_column("empresas_contratistas", "direccion")
    op.drop_column("empresas_contratistas", "mutualidad")
