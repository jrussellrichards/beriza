"""
Modelo convergido de documentos (Fase 1). Separa la biblioteca del contratista
de la revisión por mandante. Ver docs/rediseno-modelo-documentos.md.

Convive temporalmente con el modelo viejo (documento.py) mientras se migra el
dominio; el modelo viejo se elimina al final de la Fase 1.

    Expediente 1─N Entrega 1─N Archivo        (del contratista, sin mandante)
    Expediente 1─N Acreditacion               (N mandantes comparten)
    Entrega    1─N Acreditacion               (cada acreditación fija su versión)
    Acreditacion 1─N AcreditacionEvento       (bitácora particionada por mandante)
"""
import uuid
from datetime import date, datetime

from sqlalchemy import (
    BigInteger, Boolean, CheckConstraint, Date, DateTime, ForeignKey, Index,
    Integer, JSON, String, Text, UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.domain.estados import EstadoDocumento
from app.models.base import ModelBase


class Expediente(ModelBase):
    """
    Biblioteca del contratista para UN requisito y UNA entidad (empresa o
    trabajador). NO lleva mandante_id — es tenant-agnóstico. Lleva servicio_id
    solo cuando el requisito es de alcance SERVICIO (el MIPER de cada obra es
    un documento paralelo, no una versión de otro); NULL para alcance ENTIDAD.
    Dueño de la cadena de entregas (versiones).
    """
    __tablename__ = "expedientes"
    __table_args__ = (
        CheckConstraint(
            "(empresa_id IS NULL) != (trabajador_id IS NULL)",
            name="ck_expediente_entidad_xor",
        ),
    )

    requisito_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("requisitos_documentales.id"), nullable=False)
    # Una empresa O un trabajador — reforzado por ck_expediente_entidad_xor
    empresa_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("empresas_contratistas.id"), nullable=True, index=True)
    trabajador_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("trabajadores.id"), nullable=True, index=True)
    # NOT NULL solo si el requisito es de alcance SERVICIO (validado en dominio)
    servicio_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("servicios.id"), nullable=True, index=True)

    # Decisión del CONTRATISTA sobre compartir este documento suyo, que pisa el
    # default del catálogo (RequisitoDocumental.sensible, fijado por BERISA o el
    # mandante). NULL = usar el default.
    #   True  → endurecer: exigir autorización aunque el catálogo no lo pida.
    #   False → relajar: compartir sin preguntar. SOLO se permite en documentos
    #           de entidad EMPRESA. En los de TRABAJADOR el contenido es dato
    #           personal de un tercero (salud, en un examen ocupacional), y el
    #           contratista no puede renunciar a una protección que no es suya.
    # La regla se aplica en el dominio (ver reutilizacion_service.es_sensible).
    sensible_override: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

    # Soft delete — nunca DELETE físico (evidencia de auditoría)
    eliminado_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    requisito: Mapped["RequisitoDocumental"] = relationship()
    empresa: Mapped["EmpresaContratista | None"] = relationship()
    trabajador: Mapped["Trabajador | None"] = relationship()
    servicio: Mapped["Servicio | None"] = relationship()
    entregas: Mapped[list["Entrega"]] = relationship(
        back_populates="expediente", order_by="Entrega.numero_version"
    )
    acreditaciones: Mapped[list["Acreditacion"]] = relationship(back_populates="expediente")

    @property
    def empresa_duena_id(self) -> uuid.UUID | None:
        """
        La empresa contratista dueña del expediente, venga por la vía que venga.

        Un expediente cuelga de una empresa O de un trabajador (ck_expediente_
        entidad_xor), y el trabajador siempre pertenece a una empresa. Casi todo
        el dominio necesita "de qué contratista es esto" sin importar cuál de las
        dos vías se usó, y estaba resuelto copiando la misma expresión en ocho
        archivos. Cada copia era una oportunidad de olvidar la rama del
        trabajador, que es la que devuelve None silenciosamente.

        Es property de Python y no hybrid_property a propósito: todos los usos
        son sobre un objeto ya cargado. Si alguna vez hace falta filtrar por esto
        en SQL, hay que agregar la expresión — no asumir que ya funciona.
        """
        if self.empresa_id:
            return self.empresa_id
        return self.trabajador.empresa_id if self.trabajador_id else None


# Identidad única del expediente vivo (eliminado_en IS NULL):
#   alcance ENTIDAD  (servicio NULL) → único por (requisito, entidad)
#   alcance SERVICIO (servicio set)  → único por (requisito, servicio, entidad)
Index(
    "uq_exp_entidad_empresa", Expediente.requisito_id, Expediente.empresa_id,
    unique=True,
    postgresql_where=(Expediente.servicio_id.is_(None) & Expediente.empresa_id.isnot(None) & Expediente.eliminado_en.is_(None)),
)
Index(
    "uq_exp_entidad_trabajador", Expediente.requisito_id, Expediente.trabajador_id,
    unique=True,
    postgresql_where=(Expediente.servicio_id.is_(None) & Expediente.trabajador_id.isnot(None) & Expediente.eliminado_en.is_(None)),
)
Index(
    "uq_exp_servicio_empresa", Expediente.requisito_id, Expediente.servicio_id, Expediente.empresa_id,
    unique=True,
    postgresql_where=(Expediente.servicio_id.isnot(None) & Expediente.empresa_id.isnot(None) & Expediente.eliminado_en.is_(None)),
)
Index(
    "uq_exp_servicio_trabajador", Expediente.requisito_id, Expediente.servicio_id, Expediente.trabajador_id,
    unique=True,
    postgresql_where=(Expediente.servicio_id.isnot(None) & Expediente.trabajador_id.isnot(None) & Expediente.eliminado_en.is_(None)),
)


class Entrega(ModelBase):
    """
    Una versión que subió el contratista para un Expediente. Inmutable una vez
    subida (la corrección/renovación es una entrega nueva). Dueña de sus
    archivos y de la vigencia OBJETIVA del documento — fuente única de verdad
    de fecha_vigencia_hasta que todos los mandantes leen.
    """
    __tablename__ = "entregas"
    __table_args__ = (
        UniqueConstraint("expediente_id", "numero_version", name="uq_entrega_numero"),
    )

    expediente_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("expedientes.id"), nullable=False, index=True)
    numero_version: Mapped[int] = mapped_column(Integer, nullable=False)

    # Hechos del documento (extraídos por IA o ingresados en revisión manual)
    fecha_emision: Mapped[date | None] = mapped_column(Date, nullable=True)
    fecha_vigencia_hasta: Mapped[date | None] = mapped_column(Date, nullable=True)
    campos_extraidos: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    subido_por_usuario_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("usuarios.id"), nullable=True)

    expediente: Mapped["Expediente"] = relationship(back_populates="entregas")
    archivos: Mapped[list["Archivo"]] = relationship(back_populates="entrega", order_by="Archivo.orden")
    subido_por: Mapped["Usuario | None"] = relationship()


class Archivo(ModelBase):
    """
    Archivo físico en storage. Una entrega puede tener varios (contrato +
    anexos), procesados en el orden indicado. storage_key sigue siendo ÚNICO:
    compartir entre mandantes se logra con N Acreditacion → 1 Entrega, no con
    varias filas apuntando al mismo blob. La de-dup de bytes es por hash_sha256.
    """
    __tablename__ = "archivos"
    __table_args__ = (
        UniqueConstraint("entrega_id", "orden", name="uq_archivo_entrega_orden"),
    )

    entrega_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("entregas.id"), nullable=False, index=True)
    orden: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    storage_key: Mapped[str] = mapped_column(String(512), unique=True, nullable=False)
    nombre_original: Mapped[str] = mapped_column(String(255), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    tamaño_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    hash_sha256: Mapped[str] = mapped_column(String(64), nullable=False, index=True)

    entrega: Mapped["Entrega"] = relationship(back_populates="archivos")


class Acreditacion(ModelBase):
    """
    La revisión de UN mandante sobre un Expediente. Apunta con pin explícito a
    la Entrega que ese mandante está evaluando (entrega_id) — subir una versión
    nueva NO la mueve sola. La vigencia se lee de la Entrega; el umbral que
    exige el mandante vive en PerfilRequisitoConfig y produce el estado.
    Reemplaza al Documento viejo, pero SIN poseer archivos.
    """
    __tablename__ = "acreditaciones"

    mandante_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("mandantes.id"), nullable=False, index=True)
    expediente_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("expedientes.id"), nullable=False, index=True)
    # Versión que este mandante revisa. NULL = requisito exigido sin entrega aún.
    entrega_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("entregas.id"), nullable=True)
    numero_version: Mapped[int | None] = mapped_column(Integer, nullable=True)  # snapshot denormalizado

    estado: Mapped[int] = mapped_column(Integer, default=EstadoDocumento.ENVIADO)
    mensaje_brecha: Mapped[str | None] = mapped_column(Text, nullable=True)

    revisado_por_usuario_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("usuarios.id"), nullable=True)
    revisado_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    aprobado_por_excepcion: Mapped[bool] = mapped_column(Boolean, default=False)
    justificacion_excepcion: Mapped[str | None] = mapped_column(Text, nullable=True)
    aprobado_por_usuario_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("usuarios.id"), nullable=True)
    aprobado_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    eliminado_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    mandante: Mapped["Mandante"] = relationship()
    expediente: Mapped["Expediente"] = relationship(back_populates="acreditaciones")
    entrega: Mapped["Entrega | None"] = relationship()
    revisado_por: Mapped["Usuario | None"] = relationship(foreign_keys=[revisado_por_usuario_id])
    aprobado_por: Mapped["Usuario | None"] = relationship(foreign_keys=[aprobado_por_usuario_id])
    eventos: Mapped[list["AcreditacionEvento"]] = relationship(
        back_populates="acreditacion", order_by="AcreditacionEvento.created_at"
    )


# Una acreditación viva por (expediente, mandante). Para alcance SERVICIO el
# servicio ya está en el expediente, así que no hace falta en la clave.
Index(
    "uq_acreditacion_expediente_mandante", Acreditacion.expediente_id, Acreditacion.mandante_id,
    unique=True,
    postgresql_where=(Acreditacion.eliminado_en.is_(None)),
)
Index("ix_acreditaciones_mandante_estado", Acreditacion.mandante_id, Acreditacion.estado)


class AcreditacionEvento(ModelBase):
    """
    Bitácora append-only de UNA acreditación (por mandante). Aislar el historial
    por acreditación evita que un mandante vea las observaciones/aprobaciones de
    otro sobre el mismo archivo compartido.
    """
    __tablename__ = "acreditacion_eventos"

    acreditacion_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("acreditaciones.id"), nullable=False, index=True)
    tipo_evento: Mapped[str] = mapped_column(String(40), nullable=False)
    estado_anterior: Mapped[int | None] = mapped_column(Integer, nullable=True)
    estado_nuevo: Mapped[int | None] = mapped_column(Integer, nullable=True)
    actor_usuario_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("usuarios.id"), nullable=True)
    detalle: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    acreditacion: Mapped["Acreditacion"] = relationship(back_populates="eventos")
