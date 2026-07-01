import uuid
from decimal import Decimal
from sqlalchemy import String, Boolean, ForeignKey, Integer, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import ModelBase


class Mandante(ModelBase):
    __tablename__ = "mandantes"

    razon_social: Mapped[str] = mapped_column(String(255), nullable=False)
    rut: Mapped[str] = mapped_column(String(12), unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    email_contacto: Mapped[str | None] = mapped_column(String(255), nullable=True)
    sitio_web: Mapped[str | None] = mapped_column(String(255), nullable=True)
    plan: Mapped[str] = mapped_column(String(50), nullable=False, server_default="Pro")

    requisitos_config: Mapped[list["MandanteRequisitoConfig"]] = relationship(back_populates="mandante")
    usuarios: Mapped[list["Usuario"]] = relationship(back_populates="mandante")
    contratistas: Mapped[list["ContratistaMandante"]] = relationship(back_populates="mandante")


class MandanteRequisitoConfig(ModelBase):
    """Define qué documentos exige un mandante y con qué reglas."""
    __tablename__ = "mandante_requisito_config"

    mandante_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("mandantes.id"), nullable=False)
    requisito_documental_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("requisitos_documentales.id"), nullable=False)
    es_obligatorio: Mapped[bool] = mapped_column(Boolean, default=True)
    vigencia_max_dias: Mapped[int] = mapped_column(Integer, nullable=False)
    umbral_deuda_max: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)

    mandante: Mapped["Mandante"] = relationship(back_populates="requisitos_config")
    requisito: Mapped["RequisitoDocumental"] = relationship()
