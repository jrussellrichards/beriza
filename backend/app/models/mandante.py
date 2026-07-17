from sqlalchemy import String, Boolean
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

    # La configuración de requisitos vive en PerfilRequisitos/PerfilRequisitoConfig
    usuarios: Mapped[list["Usuario"]] = relationship(back_populates="mandante")
    contratistas: Mapped[list["ContratistaMandante"]] = relationship(back_populates="mandante")
