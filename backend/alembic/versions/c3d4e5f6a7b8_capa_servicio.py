"""capa servicio: perfiles de requisitos, servicios y asignación de trabajadores

Crea las 4 tablas de la capa Servicio y agrega alcance/max_archivos/
formatos_permitidos al catálogo de requisitos.

Backfill (solo para bases con datos previos):
- Un perfil "General" por mandante, copiando su mandante_requisito_config.
- Un servicio "General" por cada relación contratista↔mandante.
- Todos los trabajadores de cada empresa asignados a su servicio "General".

Los valores literales ('ACTIVO', 'ENTIDAD') son un snapshot de los enums
de app/domain/estados.py al momento de esta migración — no importar código
de la app en migraciones.

Revision ID: c3d4e5f6a7b8
Revises: a2b3c4d5e6f7
Create Date: 2026-07-13

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'a2b3c4d5e6f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Catálogo: alcance y validación de entrega data-driven ──────────────
    op.add_column('requisitos_documentales',
        sa.Column('alcance', sa.String(20), nullable=False, server_default='ENTIDAD'))
    op.add_column('requisitos_documentales',
        sa.Column('max_archivos', sa.Integer(), nullable=False, server_default='1'))
    op.add_column('requisitos_documentales',
        sa.Column('formatos_permitidos', sa.JSON(), nullable=True))

    # ── Tablas de la capa Servicio ──────────────────────────────────────────
    op.create_table('perfiles_requisitos',
        sa.Column('mandante_id', sa.Uuid(), nullable=False),
        sa.Column('nombre', sa.String(length=255), nullable=False),
        sa.Column('descripcion', sa.Text(), nullable=True),
        sa.Column('activo', sa.Boolean(), nullable=False),
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['mandante_id'], ['mandantes.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('mandante_id', 'nombre', name='uq_perfil_mandante_nombre'),
    )
    op.create_index('ix_perfiles_requisitos_mandante_id', 'perfiles_requisitos', ['mandante_id'])

    op.create_table('perfil_requisito_config',
        sa.Column('perfil_id', sa.Uuid(), nullable=False),
        sa.Column('requisito_documental_id', sa.Uuid(), nullable=False),
        sa.Column('es_obligatorio', sa.Boolean(), nullable=False),
        sa.Column('vigencia_max_dias', sa.Integer(), nullable=False),
        sa.Column('umbral_deuda_max', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('parametros_extra', sa.JSON(), nullable=True),
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['perfil_id'], ['perfiles_requisitos.id'], ),
        sa.ForeignKeyConstraint(['requisito_documental_id'], ['requisitos_documentales.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('perfil_id', 'requisito_documental_id', name='uq_perfil_requisito'),
    )

    op.create_table('servicios',
        sa.Column('contratista_mandante_id', sa.Uuid(), nullable=False),
        sa.Column('perfil_requisitos_id', sa.Uuid(), nullable=False),
        sa.Column('nombre', sa.String(length=255), nullable=False),
        sa.Column('codigo_referencia', sa.String(length=100), nullable=True),
        sa.Column('descripcion', sa.Text(), nullable=True),
        sa.Column('fecha_inicio', sa.Date(), nullable=False),
        sa.Column('fecha_termino', sa.Date(), nullable=True),
        sa.Column('estado', sa.String(length=20), nullable=False),
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['contratista_mandante_id'], ['contratistas_mandantes.id'], ),
        sa.ForeignKeyConstraint(['perfil_requisitos_id'], ['perfiles_requisitos.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_servicios_contratista_mandante_id', 'servicios', ['contratista_mandante_id'])
    op.create_index('ix_servicios_estado', 'servicios', ['estado'])
    op.create_index('uq_servicio_codigo_referencia', 'servicios',
        ['contratista_mandante_id', 'codigo_referencia'],
        unique=True,
        postgresql_where=sa.text('codigo_referencia IS NOT NULL'))

    op.create_table('servicio_trabajadores',
        sa.Column('servicio_id', sa.Uuid(), nullable=False),
        sa.Column('trabajador_id', sa.Uuid(), nullable=False),
        sa.Column('activo', sa.Boolean(), nullable=False),
        sa.Column('fecha_asignacion', sa.Date(), nullable=False),
        sa.Column('fecha_desasignacion', sa.Date(), nullable=True),
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['servicio_id'], ['servicios.id'], ),
        sa.ForeignKeyConstraint(['trabajador_id'], ['trabajadores.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('servicio_id', 'trabajador_id', name='uq_servicio_trabajador'),
    )
    op.create_index('ix_servicio_trabajadores_trabajador_id', 'servicio_trabajadores', ['trabajador_id'])

    # ── Backfill ────────────────────────────────────────────────────────────
    op.execute("""
        INSERT INTO perfiles_requisitos (id, mandante_id, nombre, descripcion, activo, created_at, updated_at)
        SELECT gen_random_uuid(), m.id, 'General',
               'Perfil creado automáticamente en la migración a servicios', true, now(), now()
        FROM mandantes m
    """)
    op.execute("""
        INSERT INTO perfil_requisito_config
            (id, perfil_id, requisito_documental_id, es_obligatorio, vigencia_max_dias,
             umbral_deuda_max, parametros_extra, created_at, updated_at)
        SELECT gen_random_uuid(), p.id, c.requisito_documental_id, c.es_obligatorio,
               c.vigencia_max_dias, c.umbral_deuda_max, NULL, now(), now()
        FROM mandante_requisito_config c
        JOIN perfiles_requisitos p ON p.mandante_id = c.mandante_id AND p.nombre = 'General'
    """)
    op.execute("""
        INSERT INTO servicios
            (id, contratista_mandante_id, perfil_requisitos_id, nombre, codigo_referencia,
             descripcion, fecha_inicio, fecha_termino, estado, created_at, updated_at)
        SELECT gen_random_uuid(), cm.id, p.id, 'General', NULL,
               'Servicio creado automáticamente en la migración a servicios',
               CURRENT_DATE, NULL, 'ACTIVO', now(), now()
        FROM contratistas_mandantes cm
        JOIN perfiles_requisitos p ON p.mandante_id = cm.mandante_id AND p.nombre = 'General'
    """)
    op.execute("""
        INSERT INTO servicio_trabajadores
            (id, servicio_id, trabajador_id, activo, fecha_asignacion, fecha_desasignacion, created_at, updated_at)
        SELECT gen_random_uuid(), s.id, t.id, t.activo, CURRENT_DATE, NULL, now(), now()
        FROM servicios s
        JOIN contratistas_mandantes cm ON cm.id = s.contratista_mandante_id
        JOIN trabajadores t ON t.empresa_id = cm.contratista_id
        WHERE s.nombre = 'General'
    """)


def downgrade() -> None:
    op.drop_table('servicio_trabajadores')
    op.drop_index('uq_servicio_codigo_referencia', table_name='servicios')
    op.drop_index('ix_servicios_estado', table_name='servicios')
    op.drop_index('ix_servicios_contratista_mandante_id', table_name='servicios')
    op.drop_table('servicios')
    op.drop_table('perfil_requisito_config')
    op.drop_index('ix_perfiles_requisitos_mandante_id', table_name='perfiles_requisitos')
    op.drop_table('perfiles_requisitos')
    op.drop_column('requisitos_documentales', 'formatos_permitidos')
    op.drop_column('requisitos_documentales', 'max_archivos')
    op.drop_column('requisitos_documentales', 'alcance')
