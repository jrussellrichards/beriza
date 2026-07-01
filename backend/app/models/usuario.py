import uuid
from sqlalchemy import String, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import ModelBase


class Usuario(ModelBase):
    __tablename__ = "usuarios"

    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)

    # Roles: berisa_admin | mandante_admin | contratista_admin | prevencionista
    rol: Mapped[str] = mapped_column(String(30), nullable=False)

    # Pertenece a un mandante O a una empresa contratista, nunca a ambos
    mandante_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("mandantes.id"), nullable=True)
    contratista_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("empresas_contratistas.id"), nullable=True)

    mandante: Mapped["Mandante | None"] = relationship(back_populates="usuarios")
    contratista: Mapped["EmpresaContratista | None"] = relationship(back_populates="usuarios")
