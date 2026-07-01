import uuid
from sqlalchemy import String, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import ModelBase


class Trabajador(ModelBase):
    __tablename__ = "trabajadores"

    empresa_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("empresas_contratistas.id"), nullable=False)
    rut: Mapped[str] = mapped_column(String(12), nullable=False)
    nombre_completo: Mapped[str] = mapped_column(String(255), nullable=False)
    cargo: Mapped[str] = mapped_column(String(255), nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)

    empresa: Mapped["EmpresaContratista"] = relationship(back_populates="trabajadores")
    documentos: Mapped[list["Documento"]] = relationship(back_populates="trabajador")
