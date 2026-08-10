"""
Lógica de negocio de servicios y perfiles de requisitos.

Un servicio es el contrato/faena concreto entre un mandante y una empresa
contratista. Cada servicio referencia un perfil de requisitos del mandante,
que define qué documentos se exigen y con qué parámetros.
"""
import logging
import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session, joinedload

from app.core.exceptions import (
    AsignacionInvalida,
    ContratistaNoEncontrado,
    EstadoServicioInvalido,
    PerfilNoEncontrado,
    ServicioNoEncontrado,
    TrabajadorNoEncontrado,
)
from app.domain.estados import EstadoServicio
from app.models.contratista import ContratistaMandante
from app.models.centro_trabajo import CentroTrabajo
from app.models.pilar import RequisitoDocumental
from app.models.servicio import PerfilRequisitos, PerfilRequisitoConfig, Servicio, ServicioTrabajador
from app.models.trabajador import Trabajador

logger = logging.getLogger("acredita")


# ── Perfiles de requisitos ────────────────────────────────────────────────────

def crear_perfil(
    db: Session,
    mandante_id: uuid.UUID,
    nombre: str,
    descripcion: str | None = None,
) -> PerfilRequisitos:
    """Crea un perfil de exigencias para el mandante. El nombre es único por mandante."""
    perfil = PerfilRequisitos(mandante_id=mandante_id, nombre=nombre, descripcion=descripcion, activo=True)
    db.add(perfil)
    db.commit()
    db.refresh(perfil)
    return perfil


def listar_perfiles(db: Session, mandante_id: uuid.UUID) -> list[PerfilRequisitos]:
    return (
        db.query(PerfilRequisitos)
        .filter_by(mandante_id=mandante_id, activo=True)
        .order_by(PerfilRequisitos.nombre)
        .all()
    )


def obtener_perfil(db: Session, perfil_id: uuid.UUID) -> PerfilRequisitos:
    perfil = db.get(PerfilRequisitos, perfil_id)
    if not perfil:
        raise PerfilNoEncontrado(f"Perfil {perfil_id} no encontrado.")
    return perfil


def configurar_requisito_perfil(
    db: Session,
    perfil_id: uuid.UUID,
    requisito_documental_id: uuid.UUID,
    es_obligatorio: bool,
    vigencia_max_dias: int,
    umbral_deuda_max: Decimal | float = 0,
    parametros_extra: dict | None = None,
) -> PerfilRequisitoConfig:
    """Agrega o actualiza (upsert) la parametrización de un requisito en el perfil."""
    obtener_perfil(db, perfil_id)
    config = db.query(PerfilRequisitoConfig).filter_by(
        perfil_id=perfil_id, requisito_documental_id=requisito_documental_id
    ).first()

    if config:
        config.es_obligatorio = es_obligatorio
        config.vigencia_max_dias = vigencia_max_dias
        config.umbral_deuda_max = umbral_deuda_max
        config.parametros_extra = parametros_extra
    else:
        config = PerfilRequisitoConfig(
            perfil_id=perfil_id,
            requisito_documental_id=requisito_documental_id,
            es_obligatorio=es_obligatorio,
            vigencia_max_dias=vigencia_max_dias,
            umbral_deuda_max=umbral_deuda_max,
            parametros_extra=parametros_extra,
        )
        db.add(config)

    db.commit()
    db.refresh(config)

    # Si el mandante empieza a exigir un requisito que sus contratistas ya tienen
    # resuelto, se les aplica de inmediato en vez de pedírselo de nuevo.
    if es_obligatorio:
        _reconciliar_contratistas_del_perfil(db, perfil_id)

    return config


def aplicar_plantilla(db: Session, perfil_id: uuid.UUID, nombre: str) -> dict:
    """
    Deja el perfil exigiendo exactamente lo que dice la plantilla.

    Es un SET, no un merge: los requisitos que la plantilla no incluye quedan en
    es_obligatorio=False, no se borran. Se conserva la fila de config para no
    perder la vigencia y el umbral que el mandante ya había parametrizado —
    apagar y volver a encender un requisito no debe resetear sus parámetros.

    Solo toca el catálogo GLOBAL. Los requisitos propios del mandante son suyos y
    una plantilla de BERISA no tiene por qué opinar sobre ellos.
    """
    from app.domain import plantillas
    from app.domain.reglas_service import VIGENCIA_DEFAULT_DIAS

    obtener_perfil(db, perfil_id)
    codigos = plantillas.codigos_de(db, nombre)

    globales = (
        db.query(RequisitoDocumental)
        .filter(RequisitoDocumental.mandante_id.is_(None))
        .all()
    )
    faltantes = codigos - {r.codigo for r in globales}
    if faltantes:
        # La plantilla nombra códigos que el catálogo no tiene: aplicarla dejaría
        # al mandante exigiendo menos de lo que cree, en silencio.
        raise ValueError(
            f"La plantilla {nombre} referencia requisitos que no existen en el "
            f"catálogo global: {', '.join(sorted(faltantes))}"
        )

    configs = {
        c.requisito_documental_id: c
        for c in db.query(PerfilRequisitoConfig).filter_by(perfil_id=perfil_id).all()
    }
    activados = desactivados = 0
    for req in globales:
        debe_exigirse = req.codigo in codigos
        config = configs.get(req.id)
        if config is None:
            db.add(PerfilRequisitoConfig(
                perfil_id=perfil_id,
                requisito_documental_id=req.id,
                es_obligatorio=debe_exigirse,
                vigencia_max_dias=VIGENCIA_DEFAULT_DIAS,
                umbral_deuda_max=0,
            ))
            if debe_exigirse:
                activados += 1
        elif config.es_obligatorio != debe_exigirse:
            config.es_obligatorio = debe_exigirse
            if debe_exigirse:
                activados += 1
            else:
                desactivados += 1
    db.commit()

    # Mismo criterio que configurar_requisito_perfil: lo que el contratista ya
    # tiene resuelto con otro mandante no se le vuelve a pedir.
    if activados:
        _reconciliar_contratistas_del_perfil(db, perfil_id)

    return {"plantilla": nombre, "exigidos": len(codigos),
            "activados": activados, "desactivados": desactivados}


def _reconciliar_contratistas_del_perfil(db: Session, perfil_id: uuid.UUID) -> None:
    """Reutilización para los contratistas con servicio activo bajo este perfil."""
    from app.domain import reutilizacion_service

    perfil = db.get(PerfilRequisitos, perfil_id)
    servicios = (
        db.query(Servicio)
        .filter_by(perfil_requisitos_id=perfil_id, estado=EstadoServicio.ACTIVO)
        .all()
    )
    contratistas = {s.relacion.contratista_id for s in servicios}
    for contratista_id in contratistas:
        try:
            reutilizacion_service.reconciliar_reutilizacion(db, contratista_id, perfil.mandante_id)
        except Exception:
            db.rollback()
            logger.exception(
                "Falló la reutilización del contratista %s tras configurar el perfil %s",
                contratista_id, perfil_id,
            )


# ── Servicios ─────────────────────────────────────────────────────────────────

def crear_servicio(
    db: Session,
    mandante_id: uuid.UUID,
    contratista_id: uuid.UUID,
    perfil_requisitos_id: uuid.UUID,
    nombre: str,
    fecha_inicio: date,
    codigo_referencia: str | None = None,
    descripcion: str | None = None,
    fecha_termino: date | None = None,
    centro_trabajo_id: uuid.UUID | None = None,
) -> Servicio:
    """
    Crea un servicio para la relación contratista↔mandante.

    Valida que la relación exista, que el perfil pertenezca al mismo mandante y
    —si viene— que el centro de trabajo también. Sin esa última comprobación un
    mandante podría colgar su servicio de una faena ajena con solo pasar el id.
    """
    relacion = db.query(ContratistaMandante).filter_by(
        contratista_id=contratista_id, mandante_id=mandante_id
    ).first()
    if not relacion:
        raise ContratistaNoEncontrado(
            f"El contratista {contratista_id} no está vinculado al mandante {mandante_id}."
        )

    perfil = obtener_perfil(db, perfil_requisitos_id)
    if perfil.mandante_id != mandante_id:
        raise AsignacionInvalida(
            f"El perfil {perfil_requisitos_id} no pertenece al mandante {mandante_id}."
        )

    if centro_trabajo_id is not None:
        centro = db.get(CentroTrabajo, centro_trabajo_id)
        if not centro or centro.mandante_id != mandante_id:
            raise AsignacionInvalida("El centro de trabajo no existe en tu organización.")
        if not centro.activo:
            raise AsignacionInvalida(
                f"El centro de trabajo «{centro.nombre}» está cerrado; "
                "no se pueden crear servicios nuevos ahí."
            )

    servicio = Servicio(
        contratista_mandante_id=relacion.id,
        perfil_requisitos_id=perfil_requisitos_id,
        nombre=nombre,
        codigo_referencia=codigo_referencia,
        descripcion=descripcion,
        fecha_inicio=fecha_inicio,
        fecha_termino=fecha_termino,
        centro_trabajo_id=centro_trabajo_id,
        estado=EstadoServicio.ACTIVO,
    )
    db.add(servicio)
    db.commit()
    db.refresh(servicio)

    # Reutilización documental: los expedientes ENTIDAD vigentes del contratista
    # se aplican automáticamente a las exigencias de este mandante (los sensibles
    # quedan pendientes de autorización). Best-effort: un fallo aquí no debe
    # revertir la creación del servicio, que ya está confirmada.
    from app.domain import notificacion_service, reutilizacion_service
    try:
        creadas = reutilizacion_service.reconciliar_reutilizacion(db, contratista_id, mandante_id)
        if creadas:
            notificacion_service.notificar_reutilizacion(db, contratista_id, mandante_id, creadas)
    except Exception:
        db.rollback()
        logger.exception(
            "Falló la reutilización documental del contratista %s para el mandante %s "
            "al crear el servicio %s", contratista_id, mandante_id, servicio.id,
        )

    return servicio


def obtener_servicio(db: Session, servicio_id: uuid.UUID) -> Servicio:
    servicio = db.get(Servicio, servicio_id)
    if not servicio:
        raise ServicioNoEncontrado(f"Servicio {servicio_id} no encontrado.")
    return servicio


def listar_servicios(
    db: Session,
    mandante_id: uuid.UUID | None = None,
    contratista_id: uuid.UUID | None = None,
) -> list[Servicio]:
    """Lista servicios filtrando por mandante y/o contratista vía la relación."""
    query = (
        db.query(Servicio)
        .join(ContratistaMandante)
        .options(
            joinedload(Servicio.relacion).joinedload(ContratistaMandante.contratista),
            joinedload(Servicio.perfil),
            joinedload(Servicio.trabajadores_asignados),
            # El centro ya se leía en la respuesta pero no se traía acá: eran dos
            # consultas extra POR SERVICIO (el centro y su encargado).
            joinedload(Servicio.centro_trabajo).joinedload(CentroTrabajo.encargado),
        )
    )
    if mandante_id:
        query = query.filter(ContratistaMandante.mandante_id == mandante_id)
    if contratista_id:
        query = query.filter(ContratistaMandante.contratista_id == contratista_id)
    return query.order_by(Servicio.created_at.desc()).all()


def actualizar_servicio(
    db: Session,
    servicio_id: uuid.UUID,
    mandante_id: uuid.UUID,
    centro_trabajo_id: uuid.UUID | None = None,
    nombre: str | None = None,
    codigo_referencia: str | None = None,
    descripcion: str | None = None,
    fecha_termino: date | None = None,
) -> Servicio:
    """
    Edita los datos descriptivos de un servicio. Solo se pasan los campos a
    cambiar; el resto queda como está.

    Existe sobre todo para poder ASIGNARLE UN CENTRO a un servicio que se creó
    antes de que existieran los centros. Sin esto la ficha mostraba "Sin centro
    asignado" y no ofrecía forma de arreglarlo: una pantalla que señala un
    problema sin dar salida.

    NO se puede cambiar el contratista ni el perfil de requisitos, a propósito:

    - Cambiar el contratista no es editar un servicio, es otro servicio.
    - Cambiar el perfil altera en silencio QUÉ documentos se exigen, y con eso el
      estado de acreditación de todos los trabajadores asignados. Un contratista
      que estaba habilitado podría dejar de estarlo sin que nadie tocara un
      documento. Si algún día hace falta, necesita su propio flujo que muestre el
      impacto antes de confirmar.
    """
    servicio = obtener_servicio(db, servicio_id)
    if servicio.relacion.mandante_id != mandante_id:
        raise AsignacionInvalida("El servicio no pertenece a tu organización.")

    if centro_trabajo_id is not None:
        centro = db.get(CentroTrabajo, centro_trabajo_id)
        if not centro or centro.mandante_id != mandante_id:
            raise AsignacionInvalida("El centro de trabajo no existe en tu organización.")
        if not centro.activo:
            raise AsignacionInvalida(
                f"El centro de trabajo «{centro.nombre}» está cerrado. "
                "Elige uno en operación."
            )
        servicio.centro_trabajo_id = centro_trabajo_id

    if nombre is not None:
        nombre = nombre.strip()
        if not nombre:
            raise AsignacionInvalida("El servicio necesita un nombre.")
        servicio.nombre = nombre

    if codigo_referencia is not None:
        servicio.codigo_referencia = codigo_referencia.strip() or None
    if descripcion is not None:
        servicio.descripcion = descripcion.strip() or None
    if fecha_termino is not None:
        if fecha_termino < servicio.fecha_inicio:
            raise AsignacionInvalida("La fecha de término no puede ser anterior al inicio.")
        servicio.fecha_termino = fecha_termino

    db.commit()
    db.refresh(servicio)
    return servicio


def cambiar_estado_servicio(db: Session, servicio_id: uuid.UUID, nuevo_estado: str) -> Servicio:
    """Cambia el estado del servicio. Un servicio TERMINADO no puede reactivarse."""
    servicio = obtener_servicio(db, servicio_id)
    try:
        nuevo = EstadoServicio(nuevo_estado)
    except ValueError:
        raise EstadoServicioInvalido(f"Estado de servicio desconocido: {nuevo_estado}")

    if servicio.estado == EstadoServicio.TERMINADO:
        raise EstadoServicioInvalido("Un servicio terminado no puede cambiar de estado.")

    servicio.estado = nuevo
    if nuevo == EstadoServicio.TERMINADO and servicio.fecha_termino is None:
        servicio.fecha_termino = date.today()
    db.commit()
    db.refresh(servicio)
    return servicio


# ── Asignación de trabajadores ────────────────────────────────────────────────

def asignar_trabajador(db: Session, servicio_id: uuid.UUID, trabajador_id: uuid.UUID) -> ServicioTrabajador:
    """
    Asigna un trabajador al servicio. La declara el contratista.
    Valida que el trabajador pertenezca a la empresa del servicio.
    Si ya existió una asignación, la reactiva en lugar de duplicarla.
    """
    servicio = obtener_servicio(db, servicio_id)
    trabajador = db.get(Trabajador, trabajador_id)
    if not trabajador:
        raise TrabajadorNoEncontrado(f"Trabajador {trabajador_id} no encontrado.")
    if trabajador.empresa_id != servicio.relacion.contratista_id:
        raise AsignacionInvalida(
            f"El trabajador {trabajador_id} no pertenece a la empresa del servicio {servicio_id}."
        )
    if servicio.estado != EstadoServicio.ACTIVO:
        raise EstadoServicioInvalido("Solo se pueden asignar trabajadores a servicios activos.")

    asignacion = db.query(ServicioTrabajador).filter_by(
        servicio_id=servicio_id, trabajador_id=trabajador_id
    ).first()
    if asignacion:
        asignacion.activo = True
        asignacion.fecha_asignacion = date.today()
        asignacion.fecha_desasignacion = None
    else:
        asignacion = ServicioTrabajador(
            servicio_id=servicio_id,
            trabajador_id=trabajador_id,
            activo=True,
            fecha_asignacion=date.today(),
        )
        db.add(asignacion)

    db.commit()
    db.refresh(asignacion)
    return asignacion


def desasignar_trabajador(db: Session, servicio_id: uuid.UUID, trabajador_id: uuid.UUID) -> None:
    """Desactiva la asignación (soft): conserva el historial de quién estuvo en la faena."""
    asignacion = db.query(ServicioTrabajador).filter_by(
        servicio_id=servicio_id, trabajador_id=trabajador_id, activo=True
    ).first()
    if not asignacion:
        raise TrabajadorNoEncontrado(
            f"El trabajador {trabajador_id} no tiene asignación activa en el servicio {servicio_id}."
        )
    asignacion.activo = False
    asignacion.fecha_desasignacion = date.today()
    db.commit()


def listar_trabajadores_servicio(db: Session, servicio_id: uuid.UUID) -> list[ServicioTrabajador]:
    obtener_servicio(db, servicio_id)
    return (
        db.query(ServicioTrabajador)
        .filter_by(servicio_id=servicio_id, activo=True)
        .all()
    )
