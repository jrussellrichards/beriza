import uuid
from sqlalchemy import String, Boolean, Integer, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import ModelBase


class Pilar(ModelBase):
    """Los 3 pilares de acreditación: Legal, HSE, Compliance."""
    __tablename__ = "pilares"

    codigo: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)  # LEGAL | HSE | COMPLIANCE
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    descripcion: Mapped[str] = mapped_column(Text, nullable=True)
    orden: Mapped[int] = mapped_column(Integer, default=0)

    subpilares: Mapped[list["Subpilar"]] = relationship(back_populates="pilar")


class Subpilar(ModelBase):
    __tablename__ = "subpilares"

    pilar_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("pilares.id"), nullable=False)
    codigo: Mapped[str] = mapped_column(String(50), nullable=False)
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    orden: Mapped[int] = mapped_column(Integer, default=0)

    pilar: Mapped["Pilar"] = relationship(back_populates="subpilares")
    requisitos: Mapped[list["RequisitoDocumental"]] = relationship(back_populates="subpilar")


class RequisitoDocumental(ModelBase):
    """Tipo de documento requerido (F30, MIPER, EXAM_MED, etc.)."""
    __tablename__ = "requisitos_documentales"

    subpilar_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("subpilares.id"), nullable=False)
    codigo: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)  # F30 | F30_1 | MIPER
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    # EMPRESA | TRABAJADOR — define a quién aplica el documento
    entidad_tipo: Mapped[str] = mapped_column(String(20), nullable=False)
    descripcion: Mapped[str] = mapped_column(Text, nullable=True)

    subpilar: Mapped["Subpilar"] = relationship(back_populates="requisitos")
