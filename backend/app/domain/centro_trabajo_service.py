"""
Centros de trabajo: el lugar físico donde se ejecuta un servicio.

Dos reglas gobiernan todo este módulo, y las dos son de aislamiento entre
mandantes:

1. Un centro pertenece a un mandante y solo él lo ve o lo usa.
2. El encargado tiene que ser alguien del EQUIPO de ese mismo mandante. Sin esa
   validación se podría dejar como responsable de una faena de Codelco a un
   usuario de otra empresa —o a un contratista—, que es una fuga de datos: el
   encargado aparece en las pantallas del centro.
"""
import uuid

from sqlalchemy.orm import Session

from app.core.exceptions import AcreditaError
from app.models.centro_trabajo import CentroTrabajo
from app.models.usuario import Usuario


class CentroTrabajoNoEncontrado(AcreditaError):
    pass


class CentroTrabajoInvalido(AcreditaError):
    pass


def _validar_encargado(db: Session, mandante_id: uuid.UUID, encargado_id: uuid.UUID | None):
    if encargado_id is None:
        return
    encargado = db.get(Usuario, encargado_id)
    if not encargado or encargado.mandante_id != mandante_id:
        raise CentroTrabajoInvalido(
            "El encargado debe ser un usuario de tu organización. "
            "Invítalo desde Equipo antes de asignarlo."
        )


def listar(db: Session, mandante_id: uuid.UUID, incluir_inactivos: bool = False) -> list[CentroTrabajo]:
    q = db.query(CentroTrabajo).filter(CentroTrabajo.mandante_id == mandante_id)
    if not incluir_inactivos:
        q = q.filter(CentroTrabajo.activo.is_(True))
    return q.order_by(CentroTrabajo.nombre).all()


def obtener(db: Session, centro_id: uuid.UUID, mandante_id: uuid.UUID) -> CentroTrabajo:
    """Siempre exige el mandante: sin eso, un id adivinado lee un centro ajeno."""
    centro = db.get(CentroTrabajo, centro_id)
    if not centro or centro.mandante_id != mandante_id:
        raise CentroTrabajoNoEncontrado("El centro de trabajo no existe en tu organización.")
    return centro


def crear(
    db: Session,
    mandante_id: uuid.UUID,
    nombre: str,
    direccion: str | None = None,
    encargado_id: uuid.UUID | None = None,
) -> CentroTrabajo:
    nombre = (nombre or "").strip()
    if not nombre:
        raise CentroTrabajoInvalido("El centro de trabajo necesita un nombre.")

    # Se comprueba antes de insertar para dar un mensaje útil: el UNIQUE de la
    # base diría "violación de restricción", que no le sirve a nadie.
    existe = db.query(CentroTrabajo).filter(
        CentroTrabajo.mandante_id == mandante_id, CentroTrabajo.nombre == nombre
    ).first()
    if existe:
        raise CentroTrabajoInvalido(f"Ya tienes un centro de trabajo llamado «{nombre}».")

    _validar_encargado(db, mandante_id, encargado_id)

    centro = CentroTrabajo(
        mandante_id=mandante_id,
        nombre=nombre,
        direccion=(direccion or "").strip() or None,
        encargado_id=encargado_id,
        activo=True,
    )
    db.add(centro)
    db.commit()
    db.refresh(centro)
    return centro


def actualizar(
    db: Session,
    centro_id: uuid.UUID,
    mandante_id: uuid.UUID,
    nombre: str | None = None,
    direccion: str | None = None,
    encargado_id: uuid.UUID | None = None,
    limpiar_encargado: bool = False,
) -> CentroTrabajo:
    """
    `limpiar_encargado` existe porque `encargado_id=None` es ambiguo en una
    actualización parcial: no se distingue "déjalo como está" de "déjalo
    vacante". Con un flag aparte, dejar el cargo vacante es explícito.
    """
    centro = obtener(db, centro_id, mandante_id)

    if nombre is not None:
        nombre = nombre.strip()
        if not nombre:
            raise CentroTrabajoInvalido("El centro de trabajo necesita un nombre.")
        choque = db.query(CentroTrabajo).filter(
            CentroTrabajo.mandante_id == mandante_id,
            CentroTrabajo.nombre == nombre,
            CentroTrabajo.id != centro_id,
        ).first()
        if choque:
            raise CentroTrabajoInvalido(f"Ya tienes un centro de trabajo llamado «{nombre}».")
        centro.nombre = nombre

    if direccion is not None:
        centro.direccion = direccion.strip() or None

    if limpiar_encargado:
        centro.encargado_id = None
    elif encargado_id is not None:
        _validar_encargado(db, mandante_id, encargado_id)
        centro.encargado_id = encargado_id

    db.commit()
    db.refresh(centro)
    return centro


def desactivar(db: Session, centro_id: uuid.UUID, mandante_id: uuid.UUID) -> CentroTrabajo:
    """
    Baja lógica. No se borra: los servicios históricos apuntan al centro y
    eliminarlo dejaría la bitácora sin dónde ocurrieron las cosas, que es
    justamente lo que se necesita en una fiscalización.
    """
    centro = obtener(db, centro_id, mandante_id)
    centro.activo = False
    db.commit()
    db.refresh(centro)
    return centro


def servicios_activos(db: Session, centro_id: uuid.UUID) -> int:
    """Cuántos servicios vigentes hay en el centro, para avisar antes de cerrarlo."""
    from app.domain.estados import EstadoServicio
    from app.models.servicio import Servicio

    return db.query(Servicio).filter(
        Servicio.centro_trabajo_id == centro_id,
        Servicio.estado == EstadoServicio.ACTIVO,
    ).count()
