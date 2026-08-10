"""nivel normativo del requisito y nueva taxonomia de subpilares

Revision ID: f8a9b0c1d2e3
Revises: e7f8a9b0c1d2
Create Date: 2026-08-06

Dos cambios que habilitan el catalogo global ampliado (de 10 a 44 requisitos).

1. Columna `nivel` en requisitos_documentales. Describe la NATURALEZA NORMATIVA
   del requisito, que es un hecho sobre la ley chilena:
     BASE     obligacion legal universal de todo empleador
     AMPLIADO exigible solo bajo un supuesto (dotacion, exposicion, tipo de obra)
     OPCIONAL practica de mercado; ninguna norma la impone al contratista
   Es deliberadamente distinto de PerfilRequisitoConfig.es_obligatorio, que dice
   que exige un mandante concreto. Mezclarlos obligaria a todos los mandantes a
   todo el catalogo: con 44 requisitos eso es un producto inusable.

   server_default OPCIONAL para que las filas existentes queden en el nivel mas
   conservador; el seed las corrige con su valor real inmediatamente despues.

2. Renombre de dos subpilares en vez de crear los nuevos y borrar los viejos.
   La taxonomia actual esta mal armada: CONTRATO (TRABAJADOR) cuelga de
   "Documentos empresa" y MIPER/RIOHS/DAS (EMPRESA) cuelgan de "Documentos
   trabajador". Renombrando en lugar de recrear, MIPER, RIOHS y VIGENCIA_SOCIEDAD
   no cambian de subpilar_id y no hay ventana con filas huerfanas. El resto de
   los movimientos los hace el seed por codigo.

No destructiva: el downgrade solo revierte los nombres y elimina la columna.
"""
from alembic import op
import sqlalchemy as sa

revision = "f8a9b0c1d2e3"
down_revision = "e7f8a9b0c1d2"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "requisitos_documentales",
        sa.Column("nivel", sa.String(20), nullable=False, server_default="OPCIONAL"),
    )

    op.execute(
        """
        UPDATE subpilares
           SET codigo = 'HSE_GESTION',
               nombre = 'Gestion preventiva y documentos del sistema'
         WHERE codigo = 'HSE_TRABAJADOR'
        """
    )
    op.execute(
        """
        UPDATE subpilares
           SET codigo = 'COMPLIANCE_SOCIETARIO',
               nombre = 'Existencia legal y representacion'
         WHERE codigo = 'COMPLIANCE_EMPRESA'
        """
    )
    op.execute(
        """
        UPDATE subpilares
           SET nombre = 'Cumplimiento laboral y previsional'
         WHERE codigo = 'LEGAL_EMPRESA'
        """
    )


def downgrade():
    op.execute(
        """
        UPDATE subpilares
           SET codigo = 'HSE_TRABAJADOR', nombre = 'Documentos trabajador'
         WHERE codigo = 'HSE_GESTION'
        """
    )
    op.execute(
        """
        UPDATE subpilares
           SET codigo = 'COMPLIANCE_EMPRESA', nombre = 'Documentos empresa'
         WHERE codigo = 'COMPLIANCE_SOCIETARIO'
        """
    )
    op.execute(
        """
        UPDATE subpilares
           SET nombre = 'Documentos empresa'
         WHERE codigo = 'LEGAL_EMPRESA'
        """
    )
    op.drop_column("requisitos_documentales", "nivel")
