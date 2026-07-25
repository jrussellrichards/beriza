"""separa el alcance de aprobacion de la administracion de la cuenta, y agrega cargo

Revision ID: b4c5d6e7f8a9
Revises: a3b4c5d6e7f8
Create Date: 2026-07-25

Antes el selector del equipo preguntaba "que puede aprobar: todo / algunos
pilares", pero elegir "todo" asignaba rol mandante_admin, que ademas administra
la cuenta (invitar gente, configurar perfiles de exigencias, crear servicios).
Quien queria un revisor senior terminaba entregando la administracion sin saberlo,
y el caso "aprueba todo pero no administra" era imposible de expresar.

`aprueba_todo` separa las dos cosas: el rol dice si administra, esta columna dice
el alcance. Es una columna y no "asignarle todos los pilares uno por uno" porque
asi sobrevive a que el mandante active un pilar nuevo despues -- con filas
explicitas esa persona dejaria de aprobarlo en silencio.

`cargo` es texto libre y NO significa nada para la autorizacion. Existe porque
cuando un cliente pide "crear un rol nuevo" casi siempre quiere ver "Jefe de
Terreno" o "Gerente HSE" en la lista del equipo, que es una etiqueta y no un
permiso.
"""
from alembic import op
import sqlalchemy as sa

revision = "b4c5d6e7f8a9"
down_revision = "a3b4c5d6e7f8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # server_default false y no nullable: un usuario existente no gana alcance
    # por una migracion. Los mandante_admin siguen aprobando todo por su rol.
    op.add_column(
        "usuarios",
        sa.Column("aprueba_todo", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column("usuarios", sa.Column("cargo", sa.String(80), nullable=True))


def downgrade() -> None:
    op.drop_column("usuarios", "cargo")
    op.drop_column("usuarios", "aprueba_todo")
