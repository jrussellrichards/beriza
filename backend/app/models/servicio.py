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
    cargos: Mapped[list["PerfilRequisitoCargo"]] = relationship(
        back_populates="config", cascade="all, delete-orphan"
    )


class PerfilRequisitoCargo(ModelBase):
    """
    A qué cargos aplica un requisito de trabajador dentro de un perfil.

    SIN FILAS = aplica a TODOS los trabajadores del servicio. Ese es el
    comportamiento que el sistema tuvo siempre, así que la tabla nace vacía y no
    cambia nada hasta que alguien la use. Es lo que hace la migración aditiva.

    CON FILAS = aplica solo a esos cargos. Sirve para lo que hoy no se puede
    decir: "la licencia clase D pídesela al conductor, no a la secretaria".

    Cuelga de PerfilRequisitoConfig y no del RequisitoDocumental global porque la
    decisión es del mandante, no de la ley: quién necesita qué depende de cómo
    ese mandante organiza su faena.
    """
    __tablename__ = "perfil_requisito_cargo"
    __table_args__ = (
        UniqueConstraint("perfil_requisito_config_id", "cargo_id", name="uq_perfil_req_cargo"),
    )

    perfil_requisito_config_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("perfil_requisito_config.id", ondelete="CASCADE"), nullable=False, index=True
    )
    cargo_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cargos.id"), nullable=False, index=True)

    config: Mapped["PerfilRequisitoConfig"] = relationship(back_populates="cargos")
    cargo: Mapped["Cargo"] = relationship()


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
    # Dónde se ejecuta. Nullable porque los servicios creados antes de que
    # existieran los centros no tienen uno, y obligarlos rompería la app entera
    # hasta que alguien los asigne a mano. El endpoint de creación sí lo exige:
    # a partir de ahora todo servicio nuevo nace con su lugar.
    centro_trabajo_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("centros_trabajo.id"), nullable=True, index=True
    )
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    codigo_referencia: Mapped[str | None] = mapped_column(String(100), nullable=True)
    descripcion: Mapped[str | None] = mapped_column(Text, nullable=True)
    fecha_inicio: Mapped[date] = mapped_column(Date, nullable=False)
    fecha_termino: Mapped[date | None] = mapped_column(Date, nullable=True)
    estado: Mapped[str] = mapped_column(String(20), default=EstadoServicio.ACTIVO, index=True)

    relacion: Mapped["ContratistaMandante"] = relationship(back_populates="servicios")
    centro_trabajo: Mapped["CentroTrabajo | None"] = relationship(back_populates="servicios")
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
    # El cargo va en la ASIGNACIÓN y no en el trabajador: la misma persona puede
    # ser operador de excavadora en un servicio y administrativo en otro, y sus
    # exigencias son distintas en cada uno.
    #
    # NULL significa "sin cargo declarado", NO significa "exento". Ver
    # acreditacion_service._aplica_a_cargo: a quien no tiene cargo se le exige
    # TODO, incluido lo restringido por cargo. Lo contrario permitiría bajar las
    # exigencias de alguien simplemente no declarando su cargo.
    cargo_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("cargos.id"), nullable=True, index=True)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    fecha_asignacion: Mapped[date] = mapped_column(Date, nullable=False)
    fecha_desasignacion: Mapped[date | None] = mapped_column(Date, nullable=True)

    servicio: Mapped["Servicio"] = relationship(back_populates="trabajadores_asignados")
    trabajador: Mapped["Trabajador"] = relationship()
    cargo: Mapped["Cargo | None"] = relationship()
