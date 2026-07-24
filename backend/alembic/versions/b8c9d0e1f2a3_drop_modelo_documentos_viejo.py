"""elimina el modelo de documentos viejo (documentos/versiones/archivos/eventos)

Cierre de Fase 1: el dominio, la API, el seed y las notificaciones ya operan
sobre Expediente/Entrega/Archivo/Acreditacion. Se eliminan las 4 tablas viejas.
Sin datos de produccion => no hay migracion de datos.

Revision ID: b8c9d0e1f2a3
Revises: a7b8c9d0e1f2
Create Date: 2026-07-23

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'b8c9d0e1f2a3'
down_revision: Union[str, None] = 'a7b8c9d0e1f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_table('documento_eventos')
    op.drop_table('archivos_documento')
    # Romper el ciclo documentos <-> documento_versiones antes de dropear.
    op.drop_constraint('fk_documento_version_vigente', 'documentos', type_='foreignkey')
    op.drop_table('documento_versiones')
    op.drop_table('documentos')


def downgrade() -> None:
    op.create_table('documentos',
        sa.Column('requisito_id', sa.Uuid(), nullable=False),
        sa.Column('mandante_id', sa.Uuid(), nullable=False),
        sa.Column('servicio_id', sa.Uuid(), nullable=True),
        sa.Column('empresa_id', sa.Uuid(), nullable=True),
        sa.Column('trabajador_id', sa.Uuid(), nullable=True),
        sa.Column('estado', sa.Integer(), nullable=False),
        sa.Column('fecha_vigencia_hasta', sa.Date(), nullable=True),
        sa.Column('mensaje_brecha', sa.Text(), nullable=True),
        sa.Column('version_vigente_id', sa.Uuid(), nullable=True),
        sa.Column('eliminado_en', sa.DateTime(timezone=True), nullable=True),
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['requisito_id'], ['requisitos_documentales.id'], ),
        sa.ForeignKeyConstraint(['mandante_id'], ['mandantes.id'], ),
        sa.ForeignKeyConstraint(['servicio_id'], ['servicios.id'], name='fk_documento_servicio'),
        sa.ForeignKeyConstraint(['empresa_id'], ['empresas_contratistas.id'], ),
        sa.ForeignKeyConstraint(['trabajador_id'], ['trabajadores.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint('(empresa_id IS NULL) != (trabajador_id IS NULL)', name='ck_documento_entidad_xor'),
    )
    op.create_index('ix_documentos_servicio_id', 'documentos', ['servicio_id'])
    op.create_index('ix_documentos_empresa_id', 'documentos', ['empresa_id'])
    op.create_index('ix_documentos_trabajador_id', 'documentos', ['trabajador_id'])
    op.create_index('ix_documentos_mandante_estado', 'documentos', ['mandante_id', 'estado'])
    op.create_index('uq_doc_servicio_empresa', 'documentos',
        ['requisito_id', 'servicio_id', 'empresa_id'], unique=True,
        postgresql_where=sa.text('servicio_id IS NOT NULL AND empresa_id IS NOT NULL AND eliminado_en IS NULL'))
    op.create_index('uq_doc_servicio_trabajador', 'documentos',
        ['requisito_id', 'servicio_id', 'trabajador_id'], unique=True,
        postgresql_where=sa.text('servicio_id IS NOT NULL AND trabajador_id IS NOT NULL AND eliminado_en IS NULL'))
    op.create_index('uq_doc_entidad_empresa', 'documentos',
        ['requisito_id', 'mandante_id', 'empresa_id'], unique=True,
        postgresql_where=sa.text('servicio_id IS NULL AND empresa_id IS NOT NULL AND eliminado_en IS NULL'))
    op.create_index('uq_doc_entidad_trabajador', 'documentos',
        ['requisito_id', 'mandante_id', 'trabajador_id'], unique=True,
        postgresql_where=sa.text('servicio_id IS NULL AND trabajador_id IS NOT NULL AND eliminado_en IS NULL'))

    op.create_table('documento_versiones',
        sa.Column('documento_id', sa.Uuid(), nullable=False),
        sa.Column('numero_version', sa.Integer(), nullable=False),
        sa.Column('estado', sa.Integer(), nullable=False),
        sa.Column('campos_extraidos', sa.JSON(), nullable=True),
        sa.Column('mensaje_brecha', sa.Text(), nullable=True),
        sa.Column('fecha_vigencia_hasta', sa.Date(), nullable=True),
        sa.Column('subido_por_usuario_id', sa.Uuid(), nullable=True),
        sa.Column('revisado_por_usuario_id', sa.Uuid(), nullable=True),
        sa.Column('revisado_en', sa.DateTime(timezone=True), nullable=True),
        sa.Column('aprobado_por_excepcion', sa.Boolean(), nullable=False),
        sa.Column('justificacion_excepcion', sa.Text(), nullable=True),
        sa.Column('aprobado_por_usuario_id', sa.Uuid(), nullable=True),
        sa.Column('aprobado_en', sa.DateTime(timezone=True), nullable=True),
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['documento_id'], ['documentos.id'], ),
        sa.ForeignKeyConstraint(['subido_por_usuario_id'], ['usuarios.id'], ),
        sa.ForeignKeyConstraint(['revisado_por_usuario_id'], ['usuarios.id'], ),
        sa.ForeignKeyConstraint(['aprobado_por_usuario_id'], ['usuarios.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('documento_id', 'numero_version', name='uq_version_numero'),
    )
    op.create_foreign_key('fk_documento_version_vigente', 'documentos', 'documento_versiones',
                          ['version_vigente_id'], ['id'])

    op.create_table('archivos_documento',
        sa.Column('documento_version_id', sa.Uuid(), nullable=False),
        sa.Column('orden', sa.Integer(), nullable=False),
        sa.Column('storage_key', sa.String(length=512), nullable=False),
        sa.Column('nombre_original', sa.String(length=255), nullable=False),
        sa.Column('mime_type', sa.String(length=100), nullable=False),
        sa.Column('tamaño_bytes', sa.BigInteger(), nullable=False),
        sa.Column('hash_sha256', sa.String(length=64), nullable=False),
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['documento_version_id'], ['documento_versiones.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('storage_key'),
        sa.UniqueConstraint('documento_version_id', 'orden', name='uq_archivo_orden'),
    )
    op.create_index('ix_archivos_documento_hash_sha256', 'archivos_documento', ['hash_sha256'])

    op.create_table('documento_eventos',
        sa.Column('documento_id', sa.Uuid(), nullable=False),
        sa.Column('documento_version_id', sa.Uuid(), nullable=True),
        sa.Column('tipo_evento', sa.String(length=40), nullable=False),
        sa.Column('estado_anterior', sa.Integer(), nullable=True),
        sa.Column('estado_nuevo', sa.Integer(), nullable=True),
        sa.Column('actor_usuario_id', sa.Uuid(), nullable=True),
        sa.Column('detalle', sa.JSON(), nullable=True),
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['documento_id'], ['documentos.id'], ),
        sa.ForeignKeyConstraint(['documento_version_id'], ['documento_versiones.id'], ),
        sa.ForeignKeyConstraint(['actor_usuario_id'], ['usuarios.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_eventos_documento_fecha', 'documento_eventos', ['documento_id', 'created_at'])
