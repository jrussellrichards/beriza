"""nuevo modelo de documentos: expedientes / entregas / archivos / acreditaciones

Fase 1 del rediseno (ver docs/rediseno-modelo-documentos.md). Crea las 5 tablas
nuevas junto a las viejas (documentos/documento_versiones/archivos_documento/
documento_eventos), que se eliminan en una migracion final de la fase cuando el
dominio deje de referenciarlas. Sin datos de produccion => no hay backfill.

Revision ID: a7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2026-07-23

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'a7b8c9d0e1f2'
down_revision: Union[str, None] = 'f6a7b8c9d0e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── expedientes ──────────────────────────────────────────────────────────
    op.create_table('expedientes',
        sa.Column('requisito_id', sa.Uuid(), nullable=False),
        sa.Column('empresa_id', sa.Uuid(), nullable=True),
        sa.Column('trabajador_id', sa.Uuid(), nullable=True),
        sa.Column('servicio_id', sa.Uuid(), nullable=True),
        sa.Column('eliminado_en', sa.DateTime(timezone=True), nullable=True),
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['requisito_id'], ['requisitos_documentales.id'], ),
        sa.ForeignKeyConstraint(['empresa_id'], ['empresas_contratistas.id'], ),
        sa.ForeignKeyConstraint(['trabajador_id'], ['trabajadores.id'], ),
        sa.ForeignKeyConstraint(['servicio_id'], ['servicios.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint('(empresa_id IS NULL) != (trabajador_id IS NULL)', name='ck_expediente_entidad_xor'),
    )
    op.create_index('ix_expedientes_empresa_id', 'expedientes', ['empresa_id'])
    op.create_index('ix_expedientes_trabajador_id', 'expedientes', ['trabajador_id'])
    op.create_index('ix_expedientes_servicio_id', 'expedientes', ['servicio_id'])
    op.create_index('uq_exp_entidad_empresa', 'expedientes',
        ['requisito_id', 'empresa_id'], unique=True,
        postgresql_where=sa.text('servicio_id IS NULL AND empresa_id IS NOT NULL AND eliminado_en IS NULL'))
    op.create_index('uq_exp_entidad_trabajador', 'expedientes',
        ['requisito_id', 'trabajador_id'], unique=True,
        postgresql_where=sa.text('servicio_id IS NULL AND trabajador_id IS NOT NULL AND eliminado_en IS NULL'))
    op.create_index('uq_exp_servicio_empresa', 'expedientes',
        ['requisito_id', 'servicio_id', 'empresa_id'], unique=True,
        postgresql_where=sa.text('servicio_id IS NOT NULL AND empresa_id IS NOT NULL AND eliminado_en IS NULL'))
    op.create_index('uq_exp_servicio_trabajador', 'expedientes',
        ['requisito_id', 'servicio_id', 'trabajador_id'], unique=True,
        postgresql_where=sa.text('servicio_id IS NOT NULL AND trabajador_id IS NOT NULL AND eliminado_en IS NULL'))

    # ── entregas ─────────────────────────────────────────────────────────────
    op.create_table('entregas',
        sa.Column('expediente_id', sa.Uuid(), nullable=False),
        sa.Column('numero_version', sa.Integer(), nullable=False),
        sa.Column('fecha_emision', sa.Date(), nullable=True),
        sa.Column('fecha_vigencia_hasta', sa.Date(), nullable=True),
        sa.Column('campos_extraidos', sa.JSON(), nullable=True),
        sa.Column('subido_por_usuario_id', sa.Uuid(), nullable=True),
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['expediente_id'], ['expedientes.id'], ),
        sa.ForeignKeyConstraint(['subido_por_usuario_id'], ['usuarios.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('expediente_id', 'numero_version', name='uq_entrega_numero'),
    )
    op.create_index('ix_entregas_expediente_id', 'entregas', ['expediente_id'])

    # ── archivos ─────────────────────────────────────────────────────────────
    op.create_table('archivos',
        sa.Column('entrega_id', sa.Uuid(), nullable=False),
        sa.Column('orden', sa.Integer(), nullable=False),
        sa.Column('storage_key', sa.String(length=512), nullable=False),
        sa.Column('nombre_original', sa.String(length=255), nullable=False),
        sa.Column('mime_type', sa.String(length=100), nullable=False),
        sa.Column('tamaño_bytes', sa.BigInteger(), nullable=False),
        sa.Column('hash_sha256', sa.String(length=64), nullable=False),
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['entrega_id'], ['entregas.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('storage_key'),
        sa.UniqueConstraint('entrega_id', 'orden', name='uq_archivo_entrega_orden'),
    )
    op.create_index('ix_archivos_entrega_id', 'archivos', ['entrega_id'])
    op.create_index('ix_archivos_hash_sha256', 'archivos', ['hash_sha256'])

    # ── acreditaciones ───────────────────────────────────────────────────────
    op.create_table('acreditaciones',
        sa.Column('mandante_id', sa.Uuid(), nullable=False),
        sa.Column('expediente_id', sa.Uuid(), nullable=False),
        sa.Column('entrega_id', sa.Uuid(), nullable=True),
        sa.Column('numero_version', sa.Integer(), nullable=True),
        sa.Column('estado', sa.Integer(), nullable=False),
        sa.Column('mensaje_brecha', sa.Text(), nullable=True),
        sa.Column('revisado_por_usuario_id', sa.Uuid(), nullable=True),
        sa.Column('revisado_en', sa.DateTime(timezone=True), nullable=True),
        sa.Column('aprobado_por_excepcion', sa.Boolean(), nullable=False),
        sa.Column('justificacion_excepcion', sa.Text(), nullable=True),
        sa.Column('aprobado_por_usuario_id', sa.Uuid(), nullable=True),
        sa.Column('aprobado_en', sa.DateTime(timezone=True), nullable=True),
        sa.Column('eliminado_en', sa.DateTime(timezone=True), nullable=True),
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['mandante_id'], ['mandantes.id'], ),
        sa.ForeignKeyConstraint(['expediente_id'], ['expedientes.id'], ),
        sa.ForeignKeyConstraint(['entrega_id'], ['entregas.id'], ),
        sa.ForeignKeyConstraint(['revisado_por_usuario_id'], ['usuarios.id'], ),
        sa.ForeignKeyConstraint(['aprobado_por_usuario_id'], ['usuarios.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_acreditaciones_mandante_id', 'acreditaciones', ['mandante_id'])
    op.create_index('ix_acreditaciones_expediente_id', 'acreditaciones', ['expediente_id'])
    op.create_index('ix_acreditaciones_mandante_estado', 'acreditaciones', ['mandante_id', 'estado'])
    op.create_index('uq_acreditacion_expediente_mandante', 'acreditaciones',
        ['expediente_id', 'mandante_id'], unique=True,
        postgresql_where=sa.text('eliminado_en IS NULL'))

    # ── acreditacion_eventos ─────────────────────────────────────────────────
    op.create_table('acreditacion_eventos',
        sa.Column('acreditacion_id', sa.Uuid(), nullable=False),
        sa.Column('tipo_evento', sa.String(length=40), nullable=False),
        sa.Column('estado_anterior', sa.Integer(), nullable=True),
        sa.Column('estado_nuevo', sa.Integer(), nullable=True),
        sa.Column('actor_usuario_id', sa.Uuid(), nullable=True),
        sa.Column('detalle', sa.JSON(), nullable=True),
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['acreditacion_id'], ['acreditaciones.id'], ),
        sa.ForeignKeyConstraint(['actor_usuario_id'], ['usuarios.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_acreditacion_eventos_acreditacion_id', 'acreditacion_eventos', ['acreditacion_id'])


def downgrade() -> None:
    op.drop_index('ix_acreditacion_eventos_acreditacion_id', table_name='acreditacion_eventos')
    op.drop_table('acreditacion_eventos')
    op.drop_index('uq_acreditacion_expediente_mandante', table_name='acreditaciones')
    op.drop_index('ix_acreditaciones_mandante_estado', table_name='acreditaciones')
    op.drop_index('ix_acreditaciones_expediente_id', table_name='acreditaciones')
    op.drop_index('ix_acreditaciones_mandante_id', table_name='acreditaciones')
    op.drop_table('acreditaciones')
    op.drop_index('ix_archivos_hash_sha256', table_name='archivos')
    op.drop_index('ix_archivos_entrega_id', table_name='archivos')
    op.drop_table('archivos')
    op.drop_index('ix_entregas_expediente_id', table_name='entregas')
    op.drop_table('entregas')
    op.drop_index('uq_exp_servicio_trabajador', table_name='expedientes')
    op.drop_index('uq_exp_servicio_empresa', table_name='expedientes')
    op.drop_index('uq_exp_entidad_trabajador', table_name='expedientes')
    op.drop_index('uq_exp_entidad_empresa', table_name='expedientes')
    op.drop_index('ix_expedientes_servicio_id', table_name='expedientes')
    op.drop_index('ix_expedientes_trabajador_id', table_name='expedientes')
    op.drop_index('ix_expedientes_empresa_id', table_name='expedientes')
    op.drop_table('expedientes')
