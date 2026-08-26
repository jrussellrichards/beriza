import uuid
from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import ModelBase


class EmpresaContratista(ModelBase):
    __tablename__ = "empresas_contratistas"

    rut: Mapped[str] = mapped_column(String(12), unique=True, nullable=False)
    razon_social: Mapped[str] = mapped_column(String(255), nullable=False)
    giro: Mapped[str] = mapped_column(String(255), nullable=True)

    # ── Datos que el mandante necesita tener a mano en una fiscalización ──────
    # Todos nullable, y no por comodidad: las empresas que ya están en la
    # plataforma se dieron de alta con RUT y razón social, y exigirlos ahora
    # dejaría a todas en un estado inválido que nadie puede arreglar hasta que
    # alguien las edite una por una.

    # Organismo administrador de la Ley 16.744. Ver Mutualidad: lista cerrada
    # porque en Chile lo es, y porque INFORMES_MUTUALIDAD y PPA_MUTUALIDAD ya se
    # exigían contra una mutualidad que el sistema no sabía cuál era.
    mutualidad: Mapped[str | None] = mapped_column(String(20), nullable=True)

    direccion: Mapped[str | None] = mapped_column(Text, nullable=True)
    # A quién llamar cuando pasa algo en faena fuera de horario de oficina.
    telefono_emergencia: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Quién puede obligar a la empresa. El RUT va aparte del nombre porque es lo
    # que permite contrastar contra el certificado de vigencia de poderes: las
    # instrucciones de revisión de VIGENCIA_PODERES piden nombre Y RUT, y con
    # solo el nombre esa comprobación no se puede hacer.
    representante_legal_nombre: Mapped[str | None] = mapped_column(String(255), nullable=True)
    representante_legal_rut: Mapped[str | None] = mapped_column(String(12), nullable=True)
    representante_legal_telefono: Mapped[str | None] = mapped_column(String(50), nullable=True)

    usuarios: Mapped[list["Usuario"]] = relationship(back_populates="contratista")
    trabajadores: Mapped[list["Trabajador"]] = relationship(back_populates="empresa")
    mandantes: Mapped[list["ContratistaMandante"]] = relationship(back_populates="contratista")


class ContratistaMandante(ModelBase):
    """
    Relación entre una empresa contratista y un mandante.
    Una empresa puede acreditarse ante múltiples mandantes independientemente.
    """
    __tablename__ = "contratistas_mandantes"
    __table_args__ = (
        UniqueConstraint("contratista_id", "mandante_id", name="uq_contratista_mandante"),
    )

    contratista_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("empresas_contratistas.id"), nullable=False)
    mandante_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("mandantes.id"), nullable=False)
    # PENDIENTE | EN_PROCESO | ACREDITADA | BLOQUEADA
    estado_acreditacion: Mapped[str] = mapped_column(String(20), default="PENDIENTE")

    contratista: Mapped["EmpresaContratista"] = relationship(back_populates="mandantes")
    mandante: Mapped["Mandante"] = relationship(back_populates="contratistas")
    servicios: Mapped[list["Servicio"]] = relationship(back_populates="relacion")
