"""documentos versionados: expediente con versiones, archivos y bitácora

Convierte cada documento en un expediente:
- documento_versiones: cada entrega, inmutable (historial completo)
- archivos_documento: 1..N archivos físicos por versión
- documento_eventos: bitácora append-only con actor

Backfill: cada documento existente pasa a ser versión 1 con su archivo_url
como único archivo (hash '0'*64 = migrado sin hash real) y un evento SUBIDA
sintético. Los documentos de requisitos alcance SERVICIO se ligan al servicio
"General" de su relación. Luego se aplican los constraints de identidad única
y se eliminan las columnas movidas a la versión.

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-07-13

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

HASH_MIGRADO = "0" * 64


def upgrade() -> None:
    # ── Tablas nuevas ────────────────────────────────────────────────────────
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

    # ── Columnas nuevas en documentos ────────────────────────────────────────
    op.add_column('documentos', sa.Column('servicio_id', sa.Uuid(), nullable=True))
    op.add_column('documentos', sa.Column('version_vigente_id', sa.Uuid(), nullable=True))
    op.add_column('documentos', sa.Column('eliminado_en', sa.DateTime(timezone=True), nullable=True))
    op.create_foreign_key('fk_documento_servicio', 'documentos', 'servicios', ['servicio_id'], ['id'])
    op.create_foreign_key('fk_documento_version_vigente', 'documentos', 'documento_versiones', ['version_vigente_id'], ['id'])
    op.create_index('ix_documentos_servicio_id', 'documentos', ['servicio_id'])
    op.create_index('ix_documentos_empresa_id', 'documentos', ['empresa_id'])
    op.create_index('ix_documentos_trabajador_id', 'documentos', ['trabajador_id'])
    op.create_index('ix_documentos_mandante_estado', 'documentos', ['mandante_id', 'estado'])

    # ── Backfill ─────────────────────────────────────────────────────────────
    # 1. Versión 1 por cada documento existente (misma id-semilla vía gen_random_uuid)
    op.execute("""
        INSERT INTO documento_versiones
            (id, documento_id, numero_version, estado, campos_extraidos, mensaje_brecha,
             fecha_vigencia_hasta, subido_por_usuario_id, revisado_por_usuario_id, revisado_en,
             aprobado_por_excepcion, justificacion_excepcion, aprobado_por_usuario_id, aprobado_en,
             created_at, updated_at)
        SELECT gen_random_uuid(), d.id, 1, d.estado, d.campos_extraidos, d.mensaje_brecha,
               d.fecha_vigencia_hasta, NULL, NULL, NULL,
               d.aprobado_por_excepcion, d.justificacion_excepcion, d.aprobado_por_usuario_id, d.aprobado_en,
               d.created_at, d.updated_at
        FROM documentos d
    """)
    # 2. El archivo original como único archivo de la versión 1
    op.execute(f"""
        INSERT INTO archivos_documento
            (id, documento_version_id, orden, storage_key, nombre_original, mime_type,
             tamaño_bytes, hash_sha256, created_at, updated_at)
        SELECT gen_random_uuid(), v.id, 0, d.archivo_url,
               regexp_replace(d.archivo_url, '^.*/', ''), 'application/pdf',
               0, '{HASH_MIGRADO}', d.created_at, d.updated_at
        FROM documentos d
        JOIN documento_versiones v ON v.documento_id = d.id AND v.numero_version = 1
    """)
    # 3. Apuntar el expediente a su versión vigente
    op.execute("""
        UPDATE documentos d
        SET version_vigente_id = v.id
        FROM documento_versiones v
        WHERE v.documento_id = d.id AND v.numero_version = 1
    """)
    # 4. Evento SUBIDA sintético
    op.execute("""
        INSERT INTO documento_eventos
            (id, documento_id, documento_version_id, tipo_evento, estado_anterior, estado_nuevo,
             actor_usuario_id, detalle, created_at, updated_at)
        SELECT gen_random_uuid(), d.id, v.id, 'SUBIDA', NULL, d.estado,
               NULL, '{"migrado": true}'::json, d.created_at, d.created_at
        FROM documentos d
        JOIN documento_versiones v ON v.documento_id = d.id AND v.numero_version = 1
    """)
    # 5. Documentos de requisitos alcance SERVICIO → servicio "General" de su relación
    op.execute("""
        UPDATE documentos d
        SET servicio_id = s.id
        FROM requisitos_documentales r,
             contratistas_mandantes cm,
             servicios s
        WHERE d.requisito_id = r.id
          AND r.alcance = 'SERVICIO'
          AND cm.mandante_id = d.mandante_id
          AND cm.contratista_id = COALESCE(
              d.empresa_id,
              (SELECT t.empresa_id FROM trabajadores t WHERE t.id = d.trabajador_id)
          )
          AND s.contratista_mandante_id = cm.id
          AND s.nombre = 'General'
    """)

    # ── Constraints de identidad ─────────────────────────────────────────────
    op.create_check_constraint(
        'ck_documento_entidad_xor', 'documentos',
        '(empresa_id IS NULL) != (trabajador_id IS NULL)',
    )
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

    # ── Columnas movidas a la versión ────────────────────────────────────────
    op.drop_column('documentos', 'archivo_url')
    op.drop_column('documentos', 'campos_extraidos')
    op.drop_column('documentos', 'frecuencia_renovacion_dias')
    op.drop_column('documentos', 'aprobado_por_excepcion')
    op.drop_column('documentos', 'justificacion_excepcion')
    op.drop_column('documentos', 'aprobado_por_usuario_id')
    op.drop_column('documentos', 'aprobado_en')


def downgrade() -> None:
    op.add_column('documentos', sa.Column('aprobado_en', sa.DateTime(timezone=True), nullable=True))
    op.add_column('documentos', sa.Column('aprobado_por_usuario_id', sa.Uuid(), nullable=True))
    op.add_column('documentos', sa.Column('justificacion_excepcion', sa.Text(), nullable=True))
    op.add_column('documentos', sa.Column('aprobado_por_excepcion', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('documentos', sa.Column('frecuencia_renovacion_dias', sa.Integer(), nullable=True))
    op.add_column('documentos', sa.Column('campos_extraidos', sa.JSON(), nullable=True))
    op.add_column('documentos', sa.Column('archivo_url', sa.String(512), nullable=False, server_default=''))

    # Restaurar datos desde la versión vigente
    op.execute("""
        UPDATE documentos d
        SET archivo_url = COALESCE(a.storage_key, ''),
            campos_extraidos = v.campos_extraidos,
            aprobado_por_excepcion = v.aprobado_por_excepcion,
            justificacion_excepcion = v.justificacion_excepcion,
            aprobado_por_usuario_id = v.aprobado_por_usuario_id,
            aprobado_en = v.aprobado_en
        FROM documento_versiones v
        LEFT JOIN archivos_documento a ON a.documento_version_id = v.id AND a.orden = 0
        WHERE v.id = d.version_vigente_id
    """)

    op.drop_index('uq_doc_entidad_trabajador', table_name='documentos')
    op.drop_index('uq_doc_entidad_empresa', table_name='documentos')
    op.drop_index('uq_doc_servicio_trabajador', table_name='documentos')
    op.drop_index('uq_doc_servicio_empresa', table_name='documentos')
    op.drop_constraint('ck_documento_entidad_xor', 'documentos', type_='check')
    op.drop_index('ix_documentos_mandante_estado', table_name='documentos')
    op.drop_index('ix_documentos_trabajador_id', table_name='documentos')
    op.drop_index('ix_documentos_empresa_id', table_name='documentos')
    op.drop_index('ix_documentos_servicio_id', table_name='documentos')
    op.drop_constraint('fk_documento_version_vigente', 'documentos', type_='foreignkey')
    op.drop_constraint('fk_documento_servicio', 'documentos', type_='foreignkey')
    op.drop_column('documentos', 'eliminado_en')
    op.drop_column('documentos', 'version_vigente_id')
    op.drop_column('documentos', 'servicio_id')

    op.drop_index('ix_eventos_documento_fecha', table_name='documento_eventos')
    op.drop_table('documento_eventos')
    op.drop_index('ix_archivos_documento_hash_sha256', table_name='archivos_documento')
    op.drop_table('archivos_documento')
    op.drop_table('documento_versiones')
