"""color del pilar en la base, en vez de repetido en cuatro dicts

Revision ID: a9b0c1d2e3f4
Revises: f8a9b0c1d2e3
Create Date: 2026-08-06

El color de cada pilar estaba hardcodeado en cuatro lugares:
  backend  api/mandantes.py  COLOR_PILAR   (codigo -> color)
  backend  api/pilares.py    COLOR_MAP     (codigo -> color)
  frontend contratistas/page.tsx PILAR_COLOR (color -> clases)
  frontend servicio/avance-panel.tsx PILAR_COLOR (CODIGO -> clases)

Los dos primeros y el ultimo indexan por `codigo`, con fallback gris. Es decir:
cualquier pilar que no se llame LEGAL, HSE o COMPLIANCE nace gris en el dashboard
y en el panel de avance, en silencio. Como el catalogo ya crecio a 11 subpilares y
existe la posibilidad de un cuarto pilar, el color pasa a ser un dato del pilar.

El backend sirve el NOMBRE del color; el frontend lo traduce a clases de Tailwind
(que no se pueden generar dinamicamente porque el JIT las purga si no aparecen
literales en el codigo).

No destructiva.
"""
from alembic import op
import sqlalchemy as sa

revision = "a9b0c1d2e3f4"
down_revision = "f8a9b0c1d2e3"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "pilares",
        sa.Column("color", sa.String(20), nullable=False, server_default="slate"),
    )
    op.execute("UPDATE pilares SET color = 'blue'   WHERE codigo = 'LEGAL'")
    op.execute("UPDATE pilares SET color = 'amber'  WHERE codigo = 'HSE'")
    op.execute("UPDATE pilares SET color = 'purple' WHERE codigo = 'COMPLIANCE'")


def downgrade():
    op.drop_column("pilares", "color")
