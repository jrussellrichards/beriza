import uuid
from sqlalchemy import String, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import ModelBase


class EmpresaContratista(ModelBase):
    __tablename__ = "empresas_contratistas"

    rut: Mapped[str] = mapped_column(String(12), unique=True, nullable=False)
    razon_social: Mapped[str] = mapped_column(String(255), nullable=False)
    giro: Mapped[str] = mapped_column(String(255), nullable=True)

    usuarios: Mapped[list["Usuario"]] = relationship(back_populates="contratista")
    trabajadores: Mapped[list["Trabajador"]] = relationship(back_populates="empresa")
    mandantes: Mapped[list["ContratistaMandante"]] = relationship(back_populates="contratista")
    documentos: Mapped[list["Documento"]] = relationship(back_populates="empresa")


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
