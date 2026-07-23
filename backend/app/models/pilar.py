import uuid
from sqlalchemy import String, Boolean, Integer, ForeignKey, JSON, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import ModelBase
from app.domain.estados import Alcance


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
    codigo: Mapped[str] = mapped_column(String(50), nullable=False)  # F30 | F30_1 | MIPER
    # NULL = catálogo global (BERISA, visible para todos). Con valor = requisito
    # propio de ese mandante, visible solo para él. La unicidad de codigo se
    # aplica por separado (global vs por mandante) via index parcial, ver migración.
    mandante_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("mandantes.id"), nullable=True)
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    # EMPRESA | TRABAJADOR — define a quién aplica el documento
    entidad_tipo: Mapped[str] = mapped_column(String(20), nullable=False)
    # ENTIDAD | SERVICIO — ENTIDAD se acredita una vez para el mandante;
    # SERVICIO se acredita por cada servicio contratado
    alcance: Mapped[str] = mapped_column(String(20), nullable=False, default=Alcance.ENTIDAD, server_default=Alcance.ENTIDAD)
    # Validación de entrega data-driven: cuántos archivos admite y qué formatos.
    # formatos_permitidos NULL = usa el default global de settings.
    max_archivos: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    formatos_permitidos: Mapped[list | None] = mapped_column(JSON, nullable=True)
    descripcion: Mapped[str] = mapped_column(Text, nullable=True)

    subpilar: Mapped["Subpilar"] = relationship(back_populates="requisitos")
