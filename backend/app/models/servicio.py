import uuid
from datetime import date
from sqlalchemy import String, Boolean, Date, ForeignKey, Index, Integer, JSON, Numeric, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from decimal import Decimal
from app.models.base import ModelBase
from app.domain.estados import EstadoServicio


class PerfilRequisitos(ModelBase):
    """
    Plantilla de exigencias documentales de un mandante
    (ej: "Obras civiles", "Servicios eléctricos"). Cada servicio
    referencia un perfil — el mandante no configura requisitos por servicio.
    """
    __tablename__ = "perfiles_requisitos"
    __table_args__ = (
        UniqueConstraint("mandante_id", "nombre", name="uq_perfil_mandante_nombre"),
    )

    mandante_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("mandantes.id"), nullable=False, index=True)
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    descripcion: Mapped[str | None] = mapped_column(Text, nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)

    mandante: Mapped["Mandante"] = relationship()
    requisitos_config: Mapped[list["PerfilRequisitoConfig"]] = relationship(back_populates="perfil")
    servicios: Mapped[list["Servicio"]] = relationship(back_populates="perfil")


class PerfilRequisitoConfig(ModelBase):
    """
    Parametrización de un requisito documental dentro de un perfil.
    """
    __tablename__ = "perfil_requisito_config"
    __table_args__ = (
        UniqueConstraint("perfil_id", "requisito_documental_id", name="uq_perfil_requisito"),
    )

    perfil_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("perfiles_requisitos.id"), nullable=False)
    requisito_documental_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("requisitos_documentales.id"), nullable=False)
    es_obligatorio: Mapped[bool] = mapped_column(Boolean, default=True)
    vigencia_max_dias: Mapped[int] = mapped_column(Integer, nullable=False)
    umbral_deuda_max: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    # Parámetros de reglas futuras sin migración de esquema; reglas_service los lee por clave
    parametros_extra: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    perfil: Mapped["PerfilRequisitos"] = relationship(back_populates="requisitos_config")
    requisito: Mapped["RequisitoDocumental"] = relationship()


class Servicio(ModelBase):
    """
    Contrato/faena concreto entre un mandante y una empresa contratista.
    Un mismo contratista puede tener varios servicios con el mismo mandante,
    cada uno con un perfil de requisitos distinto.
    """
    __tablename__ = "servicios"

    contratista_mandante_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("contratistas_mandantes.id"), nullable=False, index=True
    )
    perfil_requisitos_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("perfiles_requisitos.id"), nullable=False)
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    codigo_referencia: Mapped[str | None] = mapped_column(String(100), nullable=True)
    descripcion: Mapped[str | None] = mapped_column(Text, nullable=True)
    fecha_inicio: Mapped[date] = mapped_column(Date, nullable=False)
    fecha_termino: Mapped[date | None] = mapped_column(Date, nullable=True)
    estado: Mapped[str] = mapped_column(String(20), default=EstadoServicio.ACTIVO, index=True)

    relacion: Mapped["ContratistaMandante"] = relationship(back_populates="servicios")
    perfil: Mapped["PerfilRequisitos"] = relationship(back_populates="servicios")
    trabajadores_asignados: Mapped[list["ServicioTrabajador"]] = relationship(back_populates="servicio")


# El código de referencia (n° de contrato/OC) es único por relación cuando existe
Index(
    "uq_servicio_codigo_referencia",
    Servicio.contratista_mandante_id,
    Servicio.codigo_referencia,
    unique=True,
    postgresql_where=Servicio.codigo_referencia.isnot(None),
)


class ServicioTrabajador(ModelBase):
    """
    Asignación de un trabajador a un servicio. La declara el contratista.
    La acreditación por servicio solo evalúa trabajadores asignados y activos.
    """
    __tablename__ = "servicio_trabajadores"
    __table_args__ = (
        UniqueConstraint("servicio_id", "trabajador_id", name="uq_servicio_trabajador"),
    )

    servicio_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("servicios.id"), nullable=False)
    trabajador_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("trabajadores.id"), nullable=False, index=True)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    fecha_asignacion: Mapped[date] = mapped_column(Date, nullable=False)
    fecha_desasignacion: Mapped[date | None] = mapped_column(Date, nullable=True)

    servicio: Mapped["Servicio"] = relationship(back_populates="trabajadores_asignados")
    trabajador: Mapped["Trabajador"] = relationship()
