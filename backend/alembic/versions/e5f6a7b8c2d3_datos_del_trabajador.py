"""Datos personales y contacto de emergencia del trabajador

Observacion #6 del feedback del 25 de agosto de 2026: al agregar un trabajador
solo se pedia RUT, nombre y cargo. Faltaba a quien llamar si le pasa algo en
faena, y la fecha de nacimiento, sin la cual no se puede comprobar una
restriccion de edad.

Todas NULL: son datos de un TERCERO —la persona, no la empresa contratante— y
la Ley 21.719 exige minimizacion. Ademas hay trabajadores ya cargados por nomina
masiva, cuya plantilla solo trae RUT, nombre y cargo; exigir estos campos
dejaria a todos en estado invalido.

Revision ID: e5f6a7b8c2d3
Revises: d4e5f6a7b8c1
"""
from alembic import op
import sqlalchemy as sa

revision = "e5f6a7b8c2d3"
down_revision = "d4e5f6a7b8c1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("trabajadores", sa.Column("fecha_nacimiento", sa.Date(), nullable=True))
    op.add_column("trabajadores", sa.Column("email", sa.String(255), nullable=True))
    op.add_column("trabajadores", sa.Column("telefono", sa.String(50), nullable=True))
    op.add_column("trabajadores", sa.Column("direccion", sa.Text(), nullable=True))
    op.add_column("trabajadores", sa.Column("contacto_emergencia_nombre", sa.String(255), nullable=True))
    op.add_column("trabajadores", sa.Column("contacto_emergencia_telefono", sa.String(50), nullable=True))


def downgrade() -> None:
    op.drop_column("trabajadores", "contacto_emergencia_telefono")
    op.drop_column("trabajadores", "contacto_emergencia_nombre")
    op.drop_column("trabajadores", "direccion")
    op.drop_column("trabajadores", "telefono")
    op.drop_column("trabajadores", "email")
    op.drop_column("trabajadores", "fecha_nacimiento")
