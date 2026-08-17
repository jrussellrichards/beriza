"""se borran las configuraciones de perfil que no exigen nada

Revision ID: f8a9b0c1d2e3
Revises: c1d2e3f4a5b6
Create Date: 2026-08-17

Se acumulan por dos vias: la pantalla mostraba el catalogo entero con un
interruptor por requisito y guardaba una fila por cada uno que el usuario
tocaba aunque lo dejara apagado, y las plantillas ARRANQUE/COMPLETA/OBRA
apagaban explicitamente todo lo que no incluian en vez de borrarlo. Un perfil
con 12 exigencias arrastraba 44 filas.

Esas filas no hacen NADA: acreditacion_service filtra es_obligatorio=True, asi
que un requisito apagado es invisible para la evaluacion. Son ruido.

Se borran ahora porque la pantalla nueva invierte el significado: el perfil
pasa a ser la lista de lo que contiene, y estar en la lista ES exigirlo. Sin
esta limpieza, un perfil que hoy exige 12 documentos apareceria manana
exigiendo 44, y bloquearia contratistas por documentos que nadie pidio.
"""
from alembic import op

revision = "f8a9b0c1d2e3"
down_revision = "c1d2e3f4a5b6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("DELETE FROM perfil_requisito_config WHERE es_obligatorio = false")


def downgrade() -> None:
    # No se pueden restituir: eran filas sin efecto y no se guardo cuales eran.
    pass
