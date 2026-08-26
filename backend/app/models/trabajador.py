import uuid
from datetime import date
from sqlalchemy import Boolean, Date, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import ModelBase


class Trabajador(ModelBase):
    __tablename__ = "trabajadores"

    empresa_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("empresas_contratistas.id"), nullable=False)
    rut: Mapped[str] = mapped_column(String(12), nullable=False)
    nombre_completo: Mapped[str] = mapped_column(String(255), nullable=False)
    cargo: Mapped[str] = mapped_column(String(255), nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)

    # ── Datos personales ─────────────────────────────────────────────────────
    # Observación #6 del feedback del 25 de agosto de 2026.
    #
    # Todos nullable, y no solo por las filas que ya existen: son datos de un
    # TERCERO —la persona, no la empresa contratante— y la Ley 21.719 exige
    # minimización. Que el sistema los pueda guardar no significa que haya que
    # exigirlos. Ver docs/RESPUESTA-FEEDBACK.md: falta decidir quién los ve.
    #
    # La fecha de nacimiento tiene una razón operativa concreta y no es
    # "completar la ficha": hay faenas con restricción de edad (Ley 21.015 y el
    # trabajo de menores), y sin la fecha eso no se puede comprobar.
    fecha_nacimiento: Mapped[date | None] = mapped_column(Date, nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    telefono: Mapped[str | None] = mapped_column(String(50), nullable=True)
    direccion: Mapped[str | None] = mapped_column(Text, nullable=True)

    # A quién llamar si le pasa algo en faena. Es el dato que nadie busca hasta
    # que hace falta, y entonces hace falta en minutos.
    contacto_emergencia_nombre: Mapped[str | None] = mapped_column(String(255), nullable=True)
    contacto_emergencia_telefono: Mapped[str | None] = mapped_column(String(50), nullable=True)

    empresa: Mapped["EmpresaContratista"] = relationship(back_populates="trabajadores")
