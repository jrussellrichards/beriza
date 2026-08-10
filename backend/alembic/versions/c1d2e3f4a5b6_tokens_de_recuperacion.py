"""tokens de recuperacion de password

Revision ID: c1d2e3f4a5b6
Revises: b0c1d2e3f4a5
Create Date: 2026-08-10

Tabla propia en vez de columnas sobre `usuarios` porque el token tiene su propio
ciclo de vida —se emite, vence, se quema— y porque asi queda registro de los
intentos sin ensuciar la fila del usuario.

Se guarda el SHA-256 del token, nunca el token: quien lea esta tabla no obtiene
nada con lo que restablecer una contraseña. El UNIQUE sobre el hash es ademas lo
que hace imposible que dos emisiones colisionen en silencio.

No destructiva: solo agrega una tabla.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "c1d2e3f4a5b6"
down_revision = "b0c1d2e3f4a5"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "tokens_recuperacion",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("usuario_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("usuarios.id"), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("expira_en", sa.DateTime(timezone=True), nullable=False),
        sa.Column("usado_en", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_tokens_recuperacion_usuario_id", "tokens_recuperacion", ["usuario_id"])
    op.create_index("ix_tokens_recuperacion_token_hash", "tokens_recuperacion",
                    ["token_hash"], unique=True)


def downgrade():
    op.drop_index("ix_tokens_recuperacion_token_hash", table_name="tokens_recuperacion")
    op.drop_index("ix_tokens_recuperacion_usuario_id", table_name="tokens_recuperacion")
    op.drop_table("tokens_recuperacion")
