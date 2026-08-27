"""
Lógica de negocio de servicios y perfiles de requisitos.

Un servicio es el contrato/faena concreto entre un mandante y una empresa
contratista. Cada servicio referencia un perfil de requisitos del mandante,
que define qué documentos se exigen y con qué parámetros.
"""
import logging
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy.orm import Session, joinedload

from app.core.exceptions import (
    AsignacionInvalida,
    ContratistaNoEncontrado,
    EstadoServicioInvalido,
    PerfilNoEncontrado,
    ServicioNoEncontrado,
    ServicioNoVacio,
    TrabajadorNoEncontrado,
)
from app.domain.estados import EstadoServicio, MomentoRequisito
from app.models.contratista import ContratistaMandante
from app.models.centro_trabajo import CentroTrabajo
from app.models.expediente import Expediente
from app.models.pilar import RequisitoDocumental
from app.models.servicio import (
    PerfilRequisitos, PerfilRequisitoConfig, Servicio, ServicioEvento, ServicioTrabajador,
)
from app.models.trabajador import Trabajador

logger = logging.getLogger("acredita")


# ── Perfiles de requisitos ────────────────────────────────────────────────────

def crear_perfil(
    db: Session,
    mandante_id: uuid.UUID,
    nombre: str,
    descripcion: str | None = None,
    copiar_de: uuid.UUID | None = None,
) -> PerfilRequisitos:
    """
    Crea un perfil de exigencias para el mandante. El nombre es único por mandante.

    Con `copiar_de` parte desde otro perfil YA EXISTENTE del mismo mandante: se
    copian sus requisitos con toda su parametrización —vigencias y umbrales, que
    son la parte tediosa de rehacer— y a partir de ahí los dos son independientes.

    Reemplaza a las plantillas fijas ARRANQUE/COMPLETA/OBRA. Un catálogo de
    plantillas escrito por nosotros envejece y nunca coincide con el vocabulario
    del cliente; sus propios perfiles sí. Quien quiera "partir con todo" crea un
    perfil con todo y lo usa de plantilla.

    La copia es una FOTO, no un vínculo. Si fuera herencia viva, editar el perfil
    de origen cambiaría en silencio lo que se le exige a contratistas que ya se
    están acreditando: documentos que aparecen o desaparecen bajo sus pies y una
    acreditación que cambia de resultado sin que nadie tocara ese servicio.
    """
    perfil = PerfilRequisitos(mandante_id=mandante_id, nombre=nombre, descripcion=descripcion, activo=True)
    db.add(perfil)
    db.flush()

    if copiar_de is not None:
        origen = obtener_perfil(db, copiar_de)
        # Sin esta comprobación se copiaría el perfil de otro mandante pasando su
        # id: revelaría qué exige la competencia y arrastraría requisitos propios
        # ajenos. En producción ya apareció un perfil exigiendo requisitos de otro
        # cliente, y eso reventó un borrado por integridad referencial.
        if origen.mandante_id != mandante_id:
            raise AsignacionInvalida("El perfil de origen no pertenece a tu organización.")
        for cfg in db.query(PerfilRequisitoConfig).filter_by(perfil_id=origen.id).all():
            db.add(PerfilRequisitoConfig(
                perfil_id=perfil.id,
                requisito_documental_id=cfg.requisito_documental_id,
                es_obligatorio=cfg.es_obligatorio,
                vigencia_max_dias=cfg.vigencia_max_dias,
                umbral_deuda_max=cfg.umbral_deuda_max,
                parametros_extra=cfg.parametros_extra,
                momento=cfg.momento,
            ))

    db.commit()
    db.refresh(perfil)
    return perfil


def quitar_requisito_perfil(
    db: Session,
    perfil_id: uuid.UUID,
    requisito_documental_id: uuid.UUID,
) -> None:
    """
    Saca un requisito del perfil borrando su fila de configuración.

    No es lo mismo que apagarlo. La pantalla guardaba una fila con
    es_obligatorio=False por cada requisito que el usuario tocaba, así que un
    perfil con 12 exigencias arrastraba 44 filas. Que la fila EXISTA pase a
    significar "este perfil lo exige" deja la base diciendo lo mismo que la
    pantalla.
    """
    config = db.query(PerfilRequisitoConfig).filter_by(
        perfil_id=perfil_id, requisito_documental_id=requisito_documental_id
    ).first()
    if config:
        db.delete(config)
        db.commit()


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
    momento: str = MomentoRequisito.ARRANQUE,
) -> PerfilRequisitoConfig:
    """
    Agrega o actualiza (upsert) la parametrización de un requisito en el perfil.

    `momento` por defecto en ARRANQUE: es el comportamiento que tenía la app antes
    de que el campo existiera, así que ningún perfil ya configurado cambia de
    resultado por esto.
    """
    if momento not in set(MomentoRequisito):
        raise AsignacionInvalida(
            f"«{momento}» no es un momento válido. "
            f"Debe ser uno de: {', '.join(sorted(MomentoRequisito))}."
        )
    obtener_perfil(db, perfil_id)
    config = db.query(PerfilRequisitoConfig).filter_by(
        perfil_id=perfil_id, requisito_documental_id=requisito_documental_id
    ).first()

    if config:
        config.es_obligatorio = es_obligatorio
        config.vigencia_max_dias = vigencia_max_dias
        config.umbral_deuda_max = umbral_deuda_max
        config.parametros_extra = parametros_extra
        config.momento = momento
    else:
        config = PerfilRequisitoConfig(
            perfil_id=perfil_id,
            requisito_documental_id=requisito_documental_id,
            es_obligatorio=es_obligatorio,
            vigencia_max_dias=vigencia_max_dias,
            umbral_deuda_max=umbral_deuda_max,
            momento=momento,
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
    incluir_archivados: bool = False,
) -> list[Servicio]:
    """
    Lista servicios filtrando por mandante y/o contratista vía la relación.

    Es el ÚNICO listado de servicios del backend y alimenta los dos portales, así
    que este filtro es el que hace que archivar sirva de algo. El default es
    False —fail-closed—: si alguien agrega un llamador nuevo y se olvida del
    parámetro, el archivado se esconde, que es el comportamiento seguro.
    """
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
    if not incluir_archivados:
        query = query.filter(Servicio.archivado_en.is_(None))
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


def _registrar_evento(
    db: Session,
    servicio: Servicio,
    tipo: str,
    estado_anterior: str | None = None,
    estado_nuevo: str | None = None,
    actor_usuario_id: uuid.UUID | None = None,
    motivo: str | None = None,
) -> None:
    """Deja constancia en la bitácora del servicio. No commitea: lo hace el llamador."""
    db.add(ServicioEvento(
        servicio_id=servicio.id,
        tipo_evento=tipo,
        estado_anterior=estado_anterior,
        estado_nuevo=estado_nuevo,
        actor_usuario_id=actor_usuario_id,
        motivo=motivo,
    ))


def cambiar_estado_servicio(
    db: Session,
    servicio_id: uuid.UUID,
    nuevo_estado: str,
    actor_usuario_id: uuid.UUID | None = None,
) -> Servicio:
    """Cambia el estado del servicio. Un servicio TERMINADO no puede reactivarse."""
    servicio = obtener_servicio(db, servicio_id)
    try:
        nuevo = EstadoServicio(nuevo_estado)
    except ValueError:
        raise EstadoServicioInvalido(f"Estado de servicio desconocido: {nuevo_estado}")

    if servicio.archivado_en is not None:
        # Sin esto se podría cambiarle el estado a algo que ya nadie ve, y peor:
        # reactivar un archivado lo devolvería a la evaluación en silencio.
        raise EstadoServicioInvalido(
            "Ese servicio está archivado. Desarchívalo antes de cambiarle el estado."
        )
    if servicio.estado == EstadoServicio.TERMINADO:
        raise EstadoServicioInvalido("Un servicio terminado no puede cambiar de estado.")

    anterior = servicio.estado
    servicio.estado = nuevo
    if nuevo == EstadoServicio.TERMINADO and servicio.fecha_termino is None:
        servicio.fecha_termino = date.today()
    _registrar_evento(
        db, servicio, "CAMBIO_ESTADO",
        estado_anterior=anterior, estado_nuevo=nuevo,
        actor_usuario_id=actor_usuario_id,
    )
    db.commit()
    db.refresh(servicio)

    # El agregado que ve el mandante depende de los servicios ACTIVOS, así que
    # cambiar el estado de uno lo invalida. Se recalculaba solo al mover un
    # DOCUMENTO —subida, cron de vencimientos, pipeline de IA— y nunca al mover
    # un servicio, así que terminar la última faena dejaba al contratista
    # figurando BLOQUEADO hasta que alguien subiera cualquier papel. Y entonces
    # el cambio quedaba atribuido a esa subida, no a quien cerró la faena.
    #
    # Import local: acreditacion_service importa de este módulo, y arriba se
    # haría circular.
    from app.domain import acreditacion_service
    acreditacion_service.recalcular_estado_global(
        db, servicio.relacion.contratista_id, servicio.relacion.mandante_id
    )
    return servicio


def reactivar_servicio(
    db: Session,
    servicio_id: uuid.UUID,
    mandante_id: uuid.UUID,
    motivo: str,
    actor_usuario_id: uuid.UUID | None = None,
) -> Servicio:
    """
    Reabre un servicio TERMINADO.

    Existe por dos situaciones reales que antes no tenían salida:

      1. Alguien apretó «Terminar» queriendo «Suspender». Están uno al lado del
         otro y no había vuelta atrás.
      2. El contrato se reactivó de verdad: se extendió la obra, volvió el
         contratista a la misma faena.

    En los dos casos la única alternativa era crear un servicio nuevo desde
    cero, y con eso se perdía el historial de acreditación del anterior —quién
    estaba habilitado, qué documentos se aprobaron y cuándo—. Se perdía justo lo
    que el producto existe para conservar.

    EL MOTIVO ES OBLIGATORIO. Reabrir un contrato cerrado es la clase de acción
    por la que alguien pregunta seis meses después, y "alguien lo reactivó" sin
    el porqué es medio registro. Son cinco segundos de escribir contra una
    pregunta que no se va a poder responder nunca más.

    Vuelve a ACTIVO y no al estado que tenía antes de terminarse: reactivar
    significa que la faena opera otra vez. Si lo que se quiere es dejarlo en
    pausa, se reactiva y después se suspende — dos pasos explícitos en vez de
    uno que adivina.

    Al volver a ACTIVO, el servicio vuelve a la evaluación y sus exigencias
    vuelven a contar. cambiar_estado_servicio ya recalcula el agregado, así que
    un contratista con brechas vuelve a figurar bloqueado de inmediato: eso es
    lo correcto, y es la razón de que reactivar no sea gratis.
    """
    motivo = (motivo or "").strip()
    if not motivo:
        raise AsignacionInvalida(
            "Para reabrir un contrato cerrado hay que decir por qué. "
            "Queda en la bitácora del servicio."
        )

    servicio = obtener_servicio(db, servicio_id)
    if servicio.relacion.mandante_id != mandante_id:
        raise AsignacionInvalida("El servicio no pertenece a tu organización.")
    if servicio.archivado_en is not None:
        raise EstadoServicioInvalido(
            "Ese servicio está archivado. Desarchívalo antes de reactivarlo."
        )
    if servicio.estado != EstadoServicio.TERMINADO:
        raise EstadoServicioInvalido(
            f"«{servicio.nombre}» no está terminado, así que no hay nada que reabrir. "
            "Para volver a activarlo desde suspendido, usa Reactivar en las acciones "
            "de estado."
        )

    servicio.estado = EstadoServicio.ACTIVO
    # La fecha de término se limpia: si el contrato volvió a estar vigente, la
    # fecha en que se cerró ya no describe nada. Queda en la bitácora.
    fecha_cierre = servicio.fecha_termino
    servicio.fecha_termino = None
    _registrar_evento(
        db, servicio, "REACTIVADO",
        estado_anterior=EstadoServicio.TERMINADO,
        estado_nuevo=EstadoServicio.ACTIVO,
        actor_usuario_id=actor_usuario_id,
        motivo=f"{motivo} (cerrado el {fecha_cierre})" if fecha_cierre else motivo,
    )
    db.commit()
    db.refresh(servicio)

    # Volvió a la evaluación: sus exigencias cuentan otra vez.
    from app.domain import acreditacion_service
    acreditacion_service.recalcular_estado_global(
        db, servicio.relacion.contratista_id, servicio.relacion.mandante_id
    )
    return servicio


def historial_servicio(db: Session, servicio_id: uuid.UUID) -> list[ServicioEvento]:
    """Bitácora del servicio, de lo más antiguo a lo más nuevo."""
    return (
        db.query(ServicioEvento)
        .filter_by(servicio_id=servicio_id)
        .order_by(ServicioEvento.created_at.asc())
        .all()
    )


def motivos_no_eliminable(db: Session, servicio_id: uuid.UUID) -> list[str]:
    """
    Por qué NO se puede borrar físicamente este servicio. Lista vacía = se puede.

    Solo existen DOS claves foráneas hacia servicios.id en todo el esquema
    —ServicioTrabajador.servicio_id y Expediente.servicio_id— y todo el historial
    documental cuelga en segundo grado del expediente (entregas, archivos,
    acreditaciones, eventos). Por eso bastan dos conteos.

    Los dos son CRUDOS, sin filtrar por ningún flag, y eso es lo importante:

    - ServicioTrabajador SIN filtrar `activo`. Desasignar es SOFT: pone
      activo=False y deja la fila, que es el único registro de que esa persona
      pisó esa faena. Y `listar_trabajadores_servicio` filtra activo=True, así
      que un servicio que la interfaz muestra con CERO trabajadores puede tener
      N filas vivas. Contar solo las activas sería exactamente el borrado que
      destruye el rastro.

    - Expediente SIN filtrar `eliminado_en`. Un expediente borrado lógicamente
      sigue existiendo y sigue colgando sus entregas y archivos.

    Además, `Expediente.servicio_id` es nullable: un DELETE no fallaría por FK,
    dejaría expedientes huérfanos apuntando a la nada, en silencio. Por eso el
    guard vive acá y no se delega a la base.
    """
    motivos: list[str] = []

    n_asignaciones = (
        db.query(ServicioTrabajador).filter_by(servicio_id=servicio_id).count()
    )
    if n_asignaciones:
        motivos.append(
            f"tiene {n_asignaciones} asignación(es) de trabajadores en su historial"
        )

    n_expedientes = db.query(Expediente).filter_by(servicio_id=servicio_id).count()
    if n_expedientes:
        motivos.append(f"tiene {n_expedientes} expediente(s) documental(es)")

    return motivos


def archivar_servicio(
    db: Session,
    servicio_id: uuid.UUID,
    mandante_id: uuid.UUID,
    usuario_id: uuid.UUID | None = None,
) -> Servicio:
    """
    Saca el servicio de las listas sin tocar su historial ni su estado.

    Solo se archiva lo que YA NO está ACTIVO, y esa invariante es lo que hace
    que archivar sea seguro: el servicio ya estaba fuera de la evaluación antes
    de archivarse, así que archivarlo no puede mover ningún número derivado.

    Si se permitiera archivar un servicio ACTIVO, se lo estaría sacando de
    `evaluar_relacion` y el contratista podría pasar de BLOQUEADA a ACREDITADA
    sin que nadie subiera un documento.
    """
    servicio = obtener_servicio(db, servicio_id)
    if servicio.relacion.mandante_id != mandante_id:
        raise AsignacionInvalida("El servicio no pertenece a tu organización.")
    if servicio.archivado_en is not None:
        return servicio  # idempotente

    if servicio.estado == EstadoServicio.ACTIVO:
        raise EstadoServicioInvalido(
            "Un servicio activo no se archiva: primero suspéndelo o termínalo. "
            "Archivar solo lo esconde de la lista, no cierra el contrato."
        )

    servicio.archivado_en = datetime.now(timezone.utc)
    servicio.archivado_por_usuario_id = usuario_id
    _registrar_evento(db, servicio, "ARCHIVADO", actor_usuario_id=usuario_id)
    db.commit()
    db.refresh(servicio)
    return servicio


def desarchivar_servicio(
    db: Session, servicio_id: uuid.UUID, mandante_id: uuid.UUID
) -> Servicio:
    """
    Devuelve el servicio a las listas. El `estado` nunca se tocó, así que sigue
    siendo el que era —SUSPENDIDO o TERMINADO— y desarchivar tampoco mueve nada
    derivado.
    """
    servicio = obtener_servicio(db, servicio_id)
    if servicio.relacion.mandante_id != mandante_id:
        raise AsignacionInvalida("El servicio no pertenece a tu organización.")
    servicio.archivado_en = None
    servicio.archivado_por_usuario_id = None
    _registrar_evento(db, servicio, "DESARCHIVADO")
    db.commit()
    db.refresh(servicio)
    return servicio


def eliminar_servicio(db: Session, servicio_id: uuid.UUID, mandante_id: uuid.UUID) -> None:
    """
    Borra físicamente un servicio que no dejó rastro.

    Existe para el caso real que motivó la petición: un servicio creado por
    error, con el nombre equivocado o duplicado, que ensucia la lista para
    siempre. Ahí no hay nada que proteger.

    Todo lo demás se ARCHIVA. Borrar un servicio con acreditaciones destruiría el
    registro de qué se le exigió al contratista y qué entregó, que es lo que hace
    defendible la acreditación ante una fiscalización.
    """
    servicio = obtener_servicio(db, servicio_id)
    if servicio.relacion.mandante_id != mandante_id:
        raise AsignacionInvalida("El servicio no pertenece a tu organización.")

    motivos = motivos_no_eliminable(db, servicio_id)
    if motivos:
        raise ServicioNoVacio(
            f"«{servicio.nombre}» no se puede eliminar porque {' y '.join(motivos)}. "
            "Archívalo: sale de la lista y conserva el historial."
        )

    db.delete(servicio)
    db.commit()


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
