import uuid

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import ModelBase


class UsuarioPilarPermiso(ModelBase):
    """
    Qué pilares puede APROBAR un usuario del mandante.

    La granularidad es el pilar y no el documento porque así se organiza un
    mandante de verdad: el prevencionista revisa HSE, finanzas revisa Compliance,
    RRHH revisa Legal/Laboral. Por documento serían cientos de casillas que nadie
    mantendría (15 requisitos × 30 contratistas); por pilar son 3 o 4 decisiones
    por persona.

    Solo gobierna APROBAR. Ver queda abierto dentro del mandante: ocultar
    documentos entre colegas de la misma organización confunde y no protege a
    nadie —el mandante como entidad ya tiene derecho a verlos—, y donde hay
    responsabilidad es en la aprobación.

    `mandante_admin` no necesita filas acá: aprueba cualquier pilar.
    """
    __tablename__ = "usuario_pilar_permisos"
    __table_args__ = (
        UniqueConstraint("usuario_id", "pilar_id", name="uq_usuario_pilar"),
    )

    usuario_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("usuarios.id"), nullable=False, index=True
    )
    pilar_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("pilares.id"), nullable=False)

    usuario: Mapped["Usuario"] = relationship()
    pilar: Mapped["Pilar"] = relationship()
