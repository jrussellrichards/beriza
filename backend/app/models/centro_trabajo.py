import uuid

from sqlalchemy import Boolean, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import ModelBase


class CentroTrabajo(ModelBase):
    """
    El lugar físico donde se ejecuta el trabajo: Chuquicamata, El Teniente,
    Radomiro Tomic.

    Antes no existía como entidad. "Faena" era una etiqueta sobre el contrato de
    UN contratista —un campo `tipo` con obra/faena/servicio, ya eliminado—, así
    que con cinco contratistas en Chuquicamata había cinco contratos sueltos y
    ninguna forma de preguntar "¿cómo está Chuquicamata?".

    Cuelga del MANDANTE y el vínculo con el contratista es indirecto, a través de
    sus servicios. Esto es deliberado y es la corrección al árbol que proponía el
    informe (Mandante → Centro → Contratista → Servicio): leído literal, ese
    árbol dice que un contratista pertenece a una faena, y Transportes Altiplano
    transporta personal en Chuquicamata Y en Radomiro Tomic. No pertenece a
    ninguna: pertenece a Codelco y trabaja en las dos.

    La pantalla que el informe dibuja —agrupar por centro, y dentro listar
    contratistas— se sigue armando igual desde acá; lo que cambia es que el
    modelo soporta el caso real en vez de romperse la primera vez que ocurra.
    """
    __tablename__ = "centros_trabajo"
    __table_args__ = (
        # Dos faenas con el mismo nombre dentro de un mandante son casi siempre
        # un duplicado por tipeo, y confunden al elegir en el selector.
        UniqueConstraint("mandante_id", "nombre", name="uq_centro_mandante_nombre"),
    )

    mandante_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("mandantes.id"), nullable=False, index=True
    )
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    direccion: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Responsable del centro por parte del mandante. Nullable a propósito: el
    # cargo queda vacante cuando la persona renuncia, y exigirlo impediría darla
    # de baja. El endpoint de creación sí lo pide.
    encargado_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("usuarios.id"), nullable=True, index=True
    )

    # Baja lógica: un centro cerrado no debe aparecer al crear servicios nuevos,
    # pero los servicios históricos siguen apuntando a él y borrarlo dejaría la
    # bitácora sin dónde ocurrieron las cosas.
    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    mandante: Mapped["Mandante"] = relationship()
    encargado: Mapped["Usuario | None"] = relationship()
    servicios: Mapped[list["Servicio"]] = relationship(back_populates="centro_trabajo")
