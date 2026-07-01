import uuid
from datetime import date, datetime
from sqlalchemy import String, ForeignKey, Integer, Date, DateTime, Text, JSON, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import ModelBase


class Documento(ModelBase):
    __tablename__ = "documentos"

    requisito_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("requisitos_documentales.id"), nullable=False)
    mandante_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("mandantes.id"), nullable=False)

    # Una empresa O un trabajador — nunca ambos
    empresa_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("empresas_contratistas.id"), nullable=True)
    trabajador_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("trabajadores.id"), nullable=True)

    # Estados: 1=Enviado | 2=En Análisis | 3=Observado | 4=Aprobado
    estado: Mapped[int] = mapped_column(Integer, default=1)

    archivo_url: Mapped[str] = mapped_column(String(512), nullable=False)

    # Resultado del pipeline IA
    campos_extraidos: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    mensaje_brecha: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Vigencia extraída del documento por la IA
    fecha_vigencia_hasta: Mapped[date | None] = mapped_column(Date, nullable=True)
    frecuencia_renovacion_dias: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Aprobación manual por mandante (excepción)
    aprobado_por_excepcion: Mapped[bool] = mapped_column(Boolean, default=False)
    justificacion_excepcion: Mapped[str | None] = mapped_column(Text, nullable=True)
    aprobado_por_usuario_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("usuarios.id"), nullable=True)
    aprobado_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    requisito: Mapped["RequisitoDocumental"] = relationship()
    mandante: Mapped["Mandante"] = relationship()
    empresa: Mapped["EmpresaContratista | None"] = relationship(back_populates="documentos")
    trabajador: Mapped["Trabajador | None"] = relationship(back_populates="documentos")
    aprobado_por: Mapped["Usuario | None"] = relationship()
