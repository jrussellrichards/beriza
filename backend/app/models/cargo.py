import uuid

from sqlalchemy import String, Boolean, ForeignKey, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import ModelBase


class Cargo(ModelBase):
    """
    Cargo u ocupación con la que una persona trabaja en una faena.

    Existe para responder la pregunta que el modelo no podía responder: qué se le
    exige a ESTA persona. Hasta ahora todo requisito de entidad_tipo=TRABAJADOR
    aplicaba idéntico a toda la dotación, así que el conductor, el gásfiter y la
    secretaria recibían la misma lista.

    `Trabajador.cargo` (texto libre) se conserva: es lo que el contratista teclea
    al cargar la nómina y sirve de sugerencia y de respaldo. Este catálogo es lo
    que las reglas miran.

    mandante_id NULL = catálogo global de BERISA, visible para todos. Con valor =
    cargo propio de ese mandante. Mismo patrón que RequisitoDocumental.
    """
    __tablename__ = "cargos"
    __table_args__ = (
        # Postgres considera distintos dos NULL, así que este UNIQUE cubre los
        # cargos propios de un mandante pero NO los globales. Los globales los
        # cubre el índice parcial declarado más abajo.
        UniqueConstraint("mandante_id", "codigo", name="uq_cargo_codigo_mandante"),
    )

    mandante_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("mandantes.id"), nullable=True, index=True
    )
    codigo: Mapped[str] = mapped_column(String(50), nullable=False)
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    # Agrupación para la UI (ADMINISTRACIÓN, CONDUCTORES, ELÉCTRICA...). No tiene
    # efecto en las reglas: es para que una lista larga se pueda leer.
    area: Mapped[str | None] = mapped_column(String(120), nullable=True)
    # Baja lógica: un cargo que se deja de usar no se borra, porque hay
    # asignaciones históricas apuntándole.
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")


# Unicidad del código dentro del catálogo global (mandante_id IS NULL), que el
# UniqueConstraint de arriba no alcanza a cubrir por la semántica de NULL.
Index(
    "uq_cargo_codigo_global",
    Cargo.codigo,
    unique=True,
    postgresql_where=Cargo.mandante_id.is_(None),
)
