import uuid
from datetime import date, datetime
from sqlalchemy import (
    BigInteger, Boolean, CheckConstraint, Date, DateTime, ForeignKey, Index,
    Integer, JSON, String, Text, UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import ModelBase
from app.domain.estados import EstadoDocumento


class Documento(ModelBase):
    """
    Expediente lógico: el cumplimiento de UN requisito por UNA entidad
    (empresa o trabajador) ante un mandante — y ante un servicio específico
    si el requisito es de alcance SERVICIO. Existe una sola fila viva por
    combinación (ver índices únicos parciales); el historial de entregas
    vive en DocumentoVersion.

    estado / fecha_vigencia_hasta / mensaje_brecha son un snapshot de la
    versión vigente, denormalizados para las queries de dashboard.
    Solo documento_service los escribe.
    """
    __tablename__ = "documentos"
    __table_args__ = (
        CheckConstraint(
            "(empresa_id IS NULL) != (trabajador_id IS NULL)",
            name="ck_documento_entidad_xor",
        ),
    )

    requisito_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("requisitos_documentales.id"), nullable=False)
    mandante_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("mandantes.id"), nullable=False)

    # NOT NULL solo si el requisito es de alcance SERVICIO (validado en dominio)
    servicio_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("servicios.id"), nullable=True, index=True)

    # Una empresa O un trabajador — reforzado por ck_documento_entidad_xor
    empresa_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("empresas_contratistas.id"), nullable=True, index=True)
    trabajador_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("trabajadores.id"), nullable=True, index=True)

    # Snapshot de la versión vigente
    estado: Mapped[int] = mapped_column(Integer, default=EstadoDocumento.ENVIADO)
    fecha_vigencia_hasta: Mapped[date | None] = mapped_column(Date, nullable=True)
    mensaje_brecha: Mapped[str | None] = mapped_column(Text, nullable=True)

    version_vigente_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("documento_versiones.id", use_alter=True, name="fk_documento_version_vigente"),
        nullable=True,
    )

    # Soft delete — nunca DELETE físico (evidencia de auditoría)
    eliminado_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    requisito: Mapped["RequisitoDocumental"] = relationship()
    mandante: Mapped["Mandante"] = relationship()
    servicio: Mapped["Servicio | None"] = relationship()
    empresa: Mapped["EmpresaContratista | None"] = relationship(back_populates="documentos")
    trabajador: Mapped["Trabajador | None"] = relationship(back_populates="documentos")
    versiones: Mapped[list["DocumentoVersion"]] = relationship(
        back_populates="documento",
        foreign_keys="DocumentoVersion.documento_id",
        order_by="DocumentoVersion.numero_version",
    )
    version_vigente: Mapped["DocumentoVersion | None"] = relationship(foreign_keys=[version_vigente_id])
    eventos: Mapped[list["DocumentoEvento"]] = relationship(
        back_populates="documento", order_by="DocumentoEvento.created_at"
    )


# Identidad única del expediente vivo (eliminado_en IS NULL):
# alcance SERVICIO → único por (requisito, servicio, entidad)
# alcance ENTIDAD  → único por (requisito, mandante, entidad) con servicio NULL
Index(
    "uq_doc_servicio_empresa", Documento.requisito_id, Documento.servicio_id, Documento.empresa_id,
    unique=True,
    postgresql_where=(Documento.servicio_id.isnot(None) & Documento.empresa_id.isnot(None) & Documento.eliminado_en.is_(None)),
)
Index(
    "uq_doc_servicio_trabajador", Documento.requisito_id, Documento.servicio_id, Documento.trabajador_id,
    unique=True,
    postgresql_where=(Documento.servicio_id.isnot(None) & Documento.trabajador_id.isnot(None) & Documento.eliminado_en.is_(None)),
)
Index(
    "uq_doc_entidad_empresa", Documento.requisito_id, Documento.mandante_id, Documento.empresa_id,
    unique=True,
    postgresql_where=(Documento.servicio_id.is_(None) & Documento.empresa_id.isnot(None) & Documento.eliminado_en.is_(None)),
)
Index(
    "uq_doc_entidad_trabajador", Documento.requisito_id, Documento.mandante_id, Documento.trabajador_id,
    unique=True,
    postgresql_where=(Documento.servicio_id.is_(None) & Documento.trabajador_id.isnot(None) & Documento.eliminado_en.is_(None)),
)
Index("ix_documentos_mandante_estado", Documento.mandante_id, Documento.estado)


class DocumentoVersion(ModelBase):
    """
    Una entrega concreta del contratista. Inmutable una vez que alcanza
    estado terminal (Observado/Aprobado) — la corrección es una versión nueva.
    """
    __tablename__ = "documento_versiones"
    __table_args__ = (
        UniqueConstraint("documento_id", "numero_version", name="uq_version_numero"),
    )

    documento_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("documentos.id"), nullable=False)
    numero_version: Mapped[int] = mapped_column(Integer, nullable=False)
    estado: Mapped[int] = mapped_column(Integer, default=EstadoDocumento.ENVIADO)

    # Resultado del análisis (IA cuando esté activa; manual mientras tanto)
    campos_extraidos: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    mensaje_brecha: Mapped[str | None] = mapped_column(Text, nullable=True)
    fecha_vigencia_hasta: Mapped[date | None] = mapped_column(Date, nullable=True)

    # NULL solo en versiones migradas desde el modelo anterior
    subido_por_usuario_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("usuarios.id"), nullable=True)

    # Revisión manual del mandante (aprueba u observa esta versión)
    revisado_por_usuario_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("usuarios.id"), nullable=True)
    revisado_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Aprobación por excepción (sobre una versión observada)
    aprobado_por_excepcion: Mapped[bool] = mapped_column(Boolean, default=False)
    justificacion_excepcion: Mapped[str | None] = mapped_column(Text, nullable=True)
    aprobado_por_usuario_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("usuarios.id"), nullable=True)
    aprobado_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    documento: Mapped["Documento"] = relationship(back_populates="versiones", foreign_keys=[documento_id])
    archivos: Mapped[list["ArchivoDocumento"]] = relationship(
        back_populates="version", order_by="ArchivoDocumento.orden"
    )
    subido_por: Mapped["Usuario | None"] = relationship(foreign_keys=[subido_por_usuario_id])
    revisado_por: Mapped["Usuario | None"] = relationship(foreign_keys=[revisado_por_usuario_id])
    aprobado_por: Mapped["Usuario | None"] = relationship(foreign_keys=[aprobado_por_usuario_id])


class ArchivoDocumento(ModelBase):
    """
    Archivo físico en storage. Una versión puede tener varios (anverso/reverso,
    contrato + anexos), procesados juntos en el orden indicado.
    hash '0'*64 identifica archivos migrados sin hash real.
    """
    __tablename__ = "archivos_documento"
    __table_args__ = (
        UniqueConstraint("documento_version_id", "orden", name="uq_archivo_orden"),
    )

    documento_version_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("documento_versiones.id"), nullable=False)
    orden: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    storage_key: Mapped[str] = mapped_column(String(512), unique=True, nullable=False)
    nombre_original: Mapped[str] = mapped_column(String(255), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    tamaño_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    hash_sha256: Mapped[str] = mapped_column(String(64), nullable=False, index=True)

    version: Mapped["DocumentoVersion"] = relationship(back_populates="archivos")


class DocumentoEvento(ModelBase):
    """
    Bitácora append-only del expediente: cada subida, transición de estado
    y excepción, con actor y detalle. Nunca se actualiza ni se borra.
    actor_usuario_id NULL = acción del sistema (pipeline IA).
    """
    __tablename__ = "documento_eventos"

    documento_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("documentos.id"), nullable=False)
    documento_version_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("documento_versiones.id"), nullable=True)
    tipo_evento: Mapped[str] = mapped_column(String(40), nullable=False)
    estado_anterior: Mapped[int | None] = mapped_column(Integer, nullable=True)
    estado_nuevo: Mapped[int | None] = mapped_column(Integer, nullable=True)
    actor_usuario_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("usuarios.id"), nullable=True)
    detalle: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    documento: Mapped["Documento"] = relationship(back_populates="eventos")
    version: Mapped["DocumentoVersion | None"] = relationship()
    actor: Mapped["Usuario | None"] = relationship()


Index("ix_eventos_documento_fecha", DocumentoEvento.documento_id, DocumentoEvento.created_at)
