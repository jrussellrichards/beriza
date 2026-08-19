"""
Evaluación de acreditación — SIEMPRE derivada, nunca almacenada
(salvo el agregado ContratistaMandante.estado_acreditacion que se
recalcula aquí tras cada cambio de estado de documento).

Fuente de exigencias: los perfiles de requisitos de los SERVICIOS ACTIVOS
de cada relación contratista↔mandante. Requisitos de alcance ENTIDAD se
resuelven contra el expediente compartido (servicio NULL); los de alcance
SERVICIO contra el expediente de cada servicio que los exige.
"""
import uuid
from dataclasses import dataclass, field
from datetime import date

from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.core.exceptions import ServicioNoEncontrado
from app.domain.estados import (
    Alcance,
    EntidadTipo,
    EstadoAcreditacion,
    EstadoDocumento,
    EstadoServicio,
    MomentoRequisito,
)
from app.domain import reutilizacion_service
from app.models.cargo import Cargo
from app.models.contratista import ContratistaMandante
from app.models.expediente import Acreditacion, Expediente
from app.models.pilar import RequisitoDocumental, Subpilar
from app.models.servicio import PerfilRequisitoConfig, Servicio, ServicioTrabajador
from app.models.trabajador import Trabajador


# ── Dataclasses de resultado ──────────────────────────────────────────────────

@dataclass
class RequisitoAvance:
    requisito_id: uuid.UUID
    requisito_codigo: str
    requisito_nombre: str
    # Qué es el documento, su fundamento normativo y qué debe mirar el revisor
    # para aprobarlo. Con la revisión 100% humana este texto es la instrucción
    # de trabajo: sin él, el contratista adivina qué subir y el revisor aprueba
    # sin criterio. Viaja hasta la UI a propósito.
    requisito_descripcion: str
    entidad_tipo: str
    alcance: str
    estado: int | None            # None = documento no subido aún
    fecha_vigencia_hasta: date | None
    mensaje_brecha: str | None
    documento_id: uuid.UUID | None
    numero_version: int | None = None   # version que ESTE mandante revisa
    # Aprobado saltandose una brecha, no por cumplirla. Viaja hasta la UI
    # porque fuera del dialogo de historial se veia idéntico a una aprobación
    # normal, y son cosas distintas: una dice que el documento cumple y la
    # otra que alguien decidió dejarlo pasar igual, y quien lo decidió responde.
    aprobado_por_excepcion: bool = False
    trabajador_id: uuid.UUID | None = None
    trabajador_nombre: str | None = None
    servicio_id: uuid.UUID | None = None
    servicio_nombre: str | None = None
    pilar_codigo: str | None = None
    pilar_nombre: str | None = None
    # Config de entrega del catálogo, para que el frontend arme la subida
    max_archivos: int = 1
    # MIME aceptados, ya resueltos contra el default global. Viaja en el ITEM y no
    # se lee del expediente porque el caso que importa es el documento que aún NO
    # se ha subido: ahí no hay expediente y el contratista es justamente quien
    # necesita saber si puede mandar una foto.
    formatos_permitidos: list[str] = field(default_factory=list)


@dataclass
class PilarAvance:
    codigo: str
    nombre: str
    total: int
    aprobados: int
    cumple: bool
    requisitos: list[RequisitoAvance] = field(default_factory=list)
    color: str = "slate"


@dataclass
class TrabajadorAvance:
    trabajador_id: uuid.UUID
    nombre: str
    rut: str
    cargo: str | None
    total: int
    aprobados: int
    cumple: bool
    # Al perfil no le aplica NINGÚN requisito para el cargo de esta persona.
    # Es un estado distinto de "cumple": el sistema no puede afirmar nada sobre
    # ella, y no saber nunca puede leerse como "puede entrar". Ver _cumple_items.
    sin_requisitos: bool = False


@dataclass
class ResumenAvance:
    total_requisitos: int
    subidos: int
    aprobados: int
    observados: int
    en_analisis: int
    enviados: int
    faltantes: int
    porcentaje_avance: int  # aprobados / total, redondeado


@dataclass
class AvanceServicio:
    servicio_id: uuid.UUID
    resumen: ResumenAvance
    pilares: list[PilarAvance] = field(default_factory=list)
    trabajadores: list[TrabajadorAvance] = field(default_factory=list)


@dataclass
class EstadoPilar:
    pilar_codigo: str
    pilar_nombre: str
    cumple: bool
    brechas: list[str] = field(default_factory=list)
    # Color del pilar tal como está en la base. Antes la API lo derivaba del
    # código con un dict, así que un pilar nuevo salía gris sin aviso.
    pilar_color: str = "slate"


@dataclass
class EstadoTrabajador:
    trabajador_id: uuid.UUID
    nombre: str
    rut: str
    cumple: bool
    pilares: list[EstadoPilar] = field(default_factory=list)


@dataclass
class ResultadoAcreditacion:
    contratista_id: uuid.UUID
    mandante_id: uuid.UUID
    estado_global: str
    pilares_empresa: list[EstadoPilar] = field(default_factory=list)
    trabajadores: list[EstadoTrabajador] = field(default_factory=list)


@dataclass
class EvaluacionRelacion:
    """Evaluación completa de una relación contratista↔mandante (derivada)."""
    contratista_id: uuid.UUID
    mandante_id: uuid.UUID
    tiene_servicios_activos: bool
    items_empresa: list[RequisitoAvance] = field(default_factory=list)
    pilares_empresa: list[EstadoPilar] = field(default_factory=list)
    trabajadores: list[EstadoTrabajador] = field(default_factory=list)
    items_trabajadores: dict[str, list[RequisitoAvance]] = field(default_factory=dict)


# ── Avance por servicio ───────────────────────────────────────────────────────

def obtener_avance_servicio(db: Session, servicio_id: uuid.UUID) -> AvanceServicio:
    """
    Calcula el avance de completitud de UN servicio: qué exige su perfil,
    qué documentos existen y en qué estado, para la empresa y cada
    trabajador asignado. Función pura sobre datos persistidos.
    """
    servicio = db.get(Servicio, servicio_id)
    if not servicio:
        raise ServicioNoEncontrado(f"Servicio {servicio_id} no encontrado.")

    empresa_id = servicio.relacion.contratista_id
    mandante_id = servicio.relacion.mandante_id

    # Solo lo que a ESTE servicio, HOY, ya se le puede pedir. Un requisito
    # RECURRENTE de un servicio que parte hoy todavia no existe.
    hoy = date.today()
    configs = [
        c for c in _configs_de_perfil(db, servicio.perfil_requisitos_id)
        if _ya_es_exigible(c, servicio, hoy)
    ]
    configs_empresa = [c for c in configs if c.requisito.entidad_tipo == EntidadTipo.EMPRESA]
    configs_trabajador = [c for c in configs if c.requisito.entidad_tipo == EntidadTipo.TRABAJADOR]

    trabajadores = _trabajadores_asignados(db, [servicio_id])
    cargos = _cargos_asignados(db, [servicio_id])
    nombres_cargo = {
        c.id: c.nombre
        for c in db.query(Cargo).filter(Cargo.id.in_([v for v in cargos.values() if v])).all()
    } if any(cargos.values()) else {}

    docs_empresa = _acreds_por_clave(_acreds_de_entidad(db, mandante_id, empresa_id=empresa_id))

    items: list[RequisitoAvance] = []
    for cfg in configs_empresa:
        items.append(_item_para(docs_empresa, cfg.requisito, servicio))

    avance_trabajadores: list[TrabajadorAvance] = []
    for t in trabajadores:
        docs_t = _acreds_por_clave(_acreds_de_entidad(db, mandante_id, trabajador_id=t.id))
        cargo_id = cargos.get((servicio_id, t.id))
        items_t = [
            _item_para(docs_t, cfg.requisito, servicio, trabajador=t)
            for cfg in configs_trabajador
            if _aplica_a_cargo(cfg, cargo_id)
        ]
        items.extend(items_t)
        aprobados_t = sum(1 for i in items_t if i.estado == EstadoDocumento.APROBADO)
        # Se muestra el cargo del CATÁLOGO, no el texto libre de la nómina: es el
        # que explica por qué a esta persona se le piden N documentos y a otra M.
        # Con el texto libre, la diferencia entre dos trabajadores parecería una
        # inconsistencia del sistema en vez de la regla que el mandante configuró.
        cargo_catalogo = nombres_cargo.get(cargo_id) if cargo_id else None
        avance_trabajadores.append(TrabajadorAvance(
            trabajador_id=t.id, nombre=t.nombre_completo, rut=t.rut,
            cargo=cargo_catalogo or t.cargo,
            total=len(items_t), aprobados=aprobados_t,
            cumple=_cumple_items(items_t),
            sin_requisitos=not items_t,
        ))

    return AvanceServicio(
        servicio_id=servicio_id,
        resumen=_resumir(items),
        pilares=_agrupar_avance_por_pilar(configs, items),
        trabajadores=avance_trabajadores,
    )


# ── Evaluación de la relación (dashboards y estado global) ────────────────────

def evaluar_relacion(
    db: Session,
    contratista_id: uuid.UUID,
    mandante_id: uuid.UUID,
) -> EvaluacionRelacion:
    """
    Evalúa la relación completa contra los perfiles de TODOS sus servicios
    activos. Los requisitos alcance ENTIDAD se exigen una vez; los alcance
    SERVICIO, una vez por cada servicio activo cuyo perfil los incluya.
    Solo se evalúan trabajadores asignados a algún servicio activo.
    """
    rel = db.query(ContratistaMandante).filter_by(
        contratista_id=contratista_id, mandante_id=mandante_id
    ).first()
    servicios_activos = (
        [s for s in rel.servicios if s.estado == EstadoServicio.ACTIVO] if rel else []
    )
    evaluacion = EvaluacionRelacion(
        contratista_id=contratista_id,
        mandante_id=mandante_id,
        tiene_servicios_activos=bool(servicios_activos),
    )
    if not servicios_activos:
        return evaluacion

    # Configs de cada servicio activo, deduplicadas por requisito para el
    # alcance ENTIDAD; para el alcance SERVICIO se genera un item por servicio.
    # Mismo filtro que en el avance por servicio: lo que aun no es exigible no
    # puede contar como brecha del contratista.
    hoy = date.today()
    configs_por_servicio: dict[uuid.UUID, list[PerfilRequisitoConfig]] = {
        s.id: [c for c in _configs_de_perfil(db, s.perfil_requisitos_id)
               if _ya_es_exigible(c, s, hoy)]
        for s in servicios_activos
    }
    todas_configs: list[PerfilRequisitoConfig] = [
        c for cfgs in configs_por_servicio.values() for c in cfgs
    ]

    docs_empresa = _acreds_por_clave(_acreds_de_entidad(db, mandante_id, empresa_id=contratista_id))

    evaluacion.items_empresa = _items_de_entidad(
        docs_empresa, servicios_activos, configs_por_servicio, EntidadTipo.EMPRESA
    )
    evaluacion.pilares_empresa = _agrupar_estado_por_pilar(todas_configs, evaluacion.items_empresa)

    # Trabajadores asignados a servicios activos (y activos ellos mismos)
    asignaciones = (
        db.query(ServicioTrabajador)
        .filter(
            ServicioTrabajador.servicio_id.in_([s.id for s in servicios_activos]),
            ServicioTrabajador.activo.is_(True),
        )
        .options(joinedload(ServicioTrabajador.trabajador))
        .all()
    )
    servicios_por_trabajador: dict[uuid.UUID, set[uuid.UUID]] = {}
    trabajadores: dict[uuid.UUID, Trabajador] = {}
    # (servicio, trabajador) -> cargo con el que está asignado. Se arma acá y no
    # con una query aparte porque las asignaciones ya están cargadas.
    cargos_por_asignacion: dict[tuple, uuid.UUID | None] = {}
    for a in asignaciones:
        if not a.trabajador.activo:
            continue
        servicios_por_trabajador.setdefault(a.trabajador_id, set()).add(a.servicio_id)
        trabajadores[a.trabajador_id] = a.trabajador
        cargos_por_asignacion[(a.servicio_id, a.trabajador_id)] = a.cargo_id

    for t in trabajadores.values():
        docs_t = _acreds_por_clave(_acreds_de_entidad(db, mandante_id, trabajador_id=t.id))
        servicios_del_t = [
            s for s in servicios_activos if s.id in servicios_por_trabajador[t.id]
        ]
        items_t = _items_de_entidad(
            docs_t, servicios_del_t, configs_por_servicio, EntidadTipo.TRABAJADOR,
            trabajador=t, cargos_por_asignacion=cargos_por_asignacion,
        )
        pilares_t = _agrupar_estado_por_pilar(todas_configs, items_t)
        evaluacion.items_trabajadores[str(t.id)] = items_t
        evaluacion.trabajadores.append(EstadoTrabajador(
            trabajador_id=t.id,
            nombre=t.nombre_completo,
            rut=t.rut,
            # `all()` sobre una lista vacía es True, así que sin items esto
            # afirmaría que cumple. Misma trampa que _cumple_items resuelve en el
            # avance por servicio: sin requisitos aplicables no se puede afirmar
            # nada, y "no sé" no es "puede entrar".
            cumple=bool(items_t) and all(p.cumple for p in pilares_t),
            pilares=pilares_t,
        ))

    return evaluacion


def obtener_estado_acreditacion(
    db: Session,
    contratista_id: uuid.UUID,
    mandante_id: uuid.UUID,
) -> ResultadoAcreditacion:
    """
    Estado granular de acreditación de una empresa ante un mandante,
    derivado de los perfiles de sus servicios activos.
    """
    evaluacion = evaluar_relacion(db, contratista_id, mandante_id)
    rel = db.query(ContratistaMandante).filter_by(
        contratista_id=contratista_id, mandante_id=mandante_id
    ).first()
    estado_global = rel.estado_acreditacion if rel else EstadoAcreditacion.EN_PROCESO

    return ResultadoAcreditacion(
        contratista_id=contratista_id,
        mandante_id=mandante_id,
        estado_global=estado_global,
        pilares_empresa=evaluacion.pilares_empresa,
        trabajadores=evaluacion.trabajadores,
    )


def recalcular_estado_global(
    db: Session,
    contratista_id: uuid.UUID,
    mandante_id: uuid.UUID,
) -> str:
    """
    Recalcula y persiste el agregado en contratistas_mandantes.
    Llamado tras cada cambio de estado de documento (revisión manual,
    excepción o pipeline IA).
    """
    evaluacion = evaluar_relacion(db, contratista_id, mandante_id)

    if not evaluacion.tiene_servicios_activos:
        nuevo_estado = EstadoAcreditacion.PENDIENTE
    else:
        empresa_cumple = all(p.cumple for p in evaluacion.pilares_empresa)
        trabajadores_cumplen = all(t.cumple for t in evaluacion.trabajadores)
        if empresa_cumple and trabajadores_cumplen:
            nuevo_estado = EstadoAcreditacion.ACREDITADA
        elif not empresa_cumple:
            nuevo_estado = EstadoAcreditacion.BLOQUEADA
        else:
            nuevo_estado = EstadoAcreditacion.EN_PROCESO

    rel = db.query(ContratistaMandante).filter_by(
        contratista_id=contratista_id, mandante_id=mandante_id
    ).first()
    if rel:
        rel.estado_acreditacion = nuevo_estado
        db.commit()

    return nuevo_estado


def cumple_por_pilar(evaluacion: EvaluacionRelacion) -> dict[str, bool]:
    """
    Cumplimiento por pilar de la relación completa: el pilar cumple si
    cumple a nivel empresa Y en todos los trabajadores evaluados.
    """
    resultado: dict[str, bool] = {p.pilar_codigo: p.cumple for p in evaluacion.pilares_empresa}
    for t in evaluacion.trabajadores:
        for p in t.pilares:
            resultado[p.pilar_codigo] = resultado.get(p.pilar_codigo, True) and p.cumple
    return resultado


# ── Helpers privados ──────────────────────────────────────────────────────────

def _ya_es_exigible(config: PerfilRequisitoConfig, servicio: Servicio, hoy: date) -> bool:
    """
    Si a este servicio, hoy, ya se le puede pedir este documento.

    Sin esto todo se exigia desde el dia cero, incluidos documentos que en el dia
    cero NO PUEDEN EXISTIR: el F30-1 del mes anterior de una obra que parte hoy,
    las liquidaciones del mes en curso. El contratista figuraba incompleto por no
    entregar algo imposible y el mandante veia una brecha que no lo era.

    - ARRANQUE   se exige siempre. Es el default y el comportamiento de siempre.
    - RECURRENTE no se exige hasta que cierra el primer periodo. El largo del
      periodo se toma de `vigencia_max_dias`, que es lo que ya configura el
      mandante; modelar frecuencias de verdad es otro cambio.
    - TERMINO    solo cuando el servicio esta terminado.
    """
    momento = config.momento or MomentoRequisito.ARRANQUE

    if momento == MomentoRequisito.TERMINO:
        return servicio.estado == EstadoServicio.TERMINADO

    if momento == MomentoRequisito.RECURRENTE:
        # Un servicio ya terminado tiene todos sus periodos cerrados.
        if servicio.estado == EstadoServicio.TERMINADO:
            return True
        dias = servicio.fecha_inicio and (hoy - servicio.fecha_inicio).days
        return bool(dias is not None and dias >= (config.vigencia_max_dias or 0))

    return True


def _configs_de_perfil(db: Session, perfil_id: uuid.UUID) -> list[PerfilRequisitoConfig]:
    return (
        db.query(PerfilRequisitoConfig)
        .filter_by(perfil_id=perfil_id, es_obligatorio=True)
        .options(
            joinedload(PerfilRequisitoConfig.requisito)
            .joinedload(RequisitoDocumental.subpilar)
            .joinedload(Subpilar.pilar)
        )
        .all()
    )


def _trabajadores_asignados(db: Session, servicio_ids: list[uuid.UUID]) -> list[Trabajador]:
    asignaciones = (
        db.query(ServicioTrabajador)
        .filter(ServicioTrabajador.servicio_id.in_(servicio_ids), ServicioTrabajador.activo.is_(True))
        .options(joinedload(ServicioTrabajador.trabajador))
        .all()
    )
    vistos: dict[uuid.UUID, Trabajador] = {}
    for a in asignaciones:
        if a.trabajador.activo:
            vistos[a.trabajador_id] = a.trabajador
    return list(vistos.values())


def _cargos_asignados(db: Session, servicio_ids: list[uuid.UUID]) -> dict[tuple, uuid.UUID | None]:
    """
    Cargo con el que cada persona está asignada a cada servicio.

    La clave es (servicio_id, trabajador_id) y no solo el trabajador porque el
    cargo es de la ASIGNACIÓN: la misma persona puede ser operador en una faena y
    administrativo en otra, con exigencias distintas en cada una.
    """
    filas = (
        db.query(
            ServicioTrabajador.servicio_id,
            ServicioTrabajador.trabajador_id,
            ServicioTrabajador.cargo_id,
        )
        .filter(ServicioTrabajador.servicio_id.in_(servicio_ids), ServicioTrabajador.activo.is_(True))
        .all()
    )
    return {(f.servicio_id, f.trabajador_id): f.cargo_id for f in filas}


def _acreds_de_entidad(
    db: Session,
    mandante_id: uuid.UUID,
    empresa_id: uuid.UUID | None = None,
    trabajador_id: uuid.UUID | None = None,
) -> list[Acreditacion]:
    """Acreditaciones vivas de un mandante sobre los expedientes de una empresa o trabajador."""
    query = (
        db.query(Acreditacion)
        .join(Expediente, Acreditacion.expediente_id == Expediente.id)
        .filter(
            Acreditacion.mandante_id == mandante_id,
            Acreditacion.eliminado_en.is_(None),
            Expediente.eliminado_en.is_(None),
        )
        .options(joinedload(Acreditacion.expediente), joinedload(Acreditacion.entrega))
    )
    if empresa_id:
        query = query.filter(Expediente.empresa_id == empresa_id)
    else:
        query = query.filter(Expediente.trabajador_id == trabajador_id)
    return query.all()


def _acreds_por_clave(acreditaciones: list[Acreditacion]) -> dict[tuple[str, str | None], Acreditacion]:
    """
    Indexa acreditaciones vivas por (requisito_id, servicio_id|None) de su expediente.
    La identidad única está garantizada por los índices parciales de BD.
    """
    return {
        (str(a.expediente.requisito_id), str(a.expediente.servicio_id) if a.expediente.servicio_id else None): a
        for a in acreditaciones
    }


def _item_para(
    docs: dict[tuple[str, str | None], Acreditacion],
    requisito: RequisitoDocumental,
    servicio: Servicio | None,
    trabajador: Trabajador | None = None,
) -> RequisitoAvance:
    """Item de avance para un requisito: busca la acreditación según su alcance."""
    es_por_servicio = requisito.alcance == Alcance.SERVICIO and servicio is not None
    clave = (str(requisito.id), str(servicio.id) if es_por_servicio else None)
    acred = docs.get(clave)
    pilar = requisito.subpilar.pilar
    vigencia = acred.entrega.fecha_vigencia_hasta if (acred and acred.entrega) else None
    return RequisitoAvance(
        pilar_codigo=pilar.codigo,
        pilar_nombre=pilar.nombre,
        max_archivos=requisito.max_archivos,
        requisito_id=requisito.id,
        requisito_codigo=requisito.codigo,
        requisito_nombre=requisito.nombre,
        requisito_descripcion=requisito.descripcion or "",
        formatos_permitidos=(
            requisito.formatos_permitidos or list(settings.FORMATOS_PERMITIDOS_DEFAULT)
        ),
        entidad_tipo=requisito.entidad_tipo,
        alcance=requisito.alcance,
        estado=acred.estado if acred else None,
        fecha_vigencia_hasta=vigencia,
        mensaje_brecha=acred.mensaje_brecha if acred else None,
        documento_id=acred.id if acred else None,
        numero_version=acred.numero_version if acred else None,
        aprobado_por_excepcion=bool(acred.aprobado_por_excepcion) if acred else False,
        trabajador_id=trabajador.id if trabajador else None,
        trabajador_nombre=trabajador.nombre_completo if trabajador else None,
        servicio_id=servicio.id if es_por_servicio else None,
        servicio_nombre=servicio.nombre if es_por_servicio else None,
    )


def _cumple_items(items: list) -> bool:
    """
    ¿Esta persona cumple? Solo si tiene items exigidos Y todos están aprobados.

    La lista VACÍA devuelve False, y ese es el punto de esta función. Con
    `aprobados == total` una lista vacía da 0 == 0 = True, así que alguien a
    quien no le aplica ningún requisito —porque su cargo quedó fuera de todos—
    aparecía habilitado sin haber subido un solo documento. Es el mismo falso
    verde que el fail-closed de _aplica_a_cargo evita para el cargo NULL, una
    rama más allá.

    No saber no puede leerse como "puede entrar". El mandante lo resuelve
    asignándole requisitos a ese cargo o sacando a la persona de la faena; la UI
    lo distingue con `sin_requisitos` para no decir "no cumple" cuando en verdad
    es "no evaluable".
    """
    return bool(items) and all(i.estado == EstadoDocumento.APROBADO for i in items)


def _aplica_a_cargo(cfg: PerfilRequisitoConfig, cargo_id) -> bool:
    """
    ¿Este requisito le aplica a alguien asignado con este cargo?

    Regla, en dos partes:

    - El config SIN cargos configurados aplica a todos. Es el comportamiento que
      el sistema tuvo siempre, y lo que hace que la tabla vacía no cambie nada.

    - El config CON cargos aplica solo a esos... salvo que la persona no tenga
      cargo declarado, en cuyo caso también le aplica. FAIL-CLOSED, deliberado:
      si un trabajador sin cargo quedara exento de lo restringido por cargo,
      omitir el cargo bajaría sus exigencias, y alguien sin un solo documento
      aparecería habilitado porque `habilitado = not faltantes` con cero items da
      True. El costo de equivocarse hacia este lado es ruido; hacia el otro, una
      persona entrando a faena sin acreditar.
    """
    if not cfg.cargos:
        return True
    if cargo_id is None:
        return True
    return any(pc.cargo_id == cargo_id for pc in cfg.cargos)


def _items_de_entidad(
    docs: dict[tuple[str, str | None], Acreditacion],
    servicios: list[Servicio],
    configs_por_servicio: dict[uuid.UUID, list[PerfilRequisitoConfig]],
    entidad_tipo: str,
    trabajador: Trabajador | None = None,
    cargos_por_asignacion: dict[tuple, uuid.UUID | None] | None = None,
) -> list[RequisitoAvance]:
    """
    Items de una entidad (empresa o trabajador) para varios servicios:
    alcance ENTIDAD → un solo item (deduplicado entre perfiles);
    alcance SERVICIO → un item por cada servicio cuyo perfil lo exige.

    `cargos_por_asignacion` mapea (servicio_id, trabajador_id) → cargo_id y filtra
    los requisitos restringidos por cargo. Si no se pasa, no se filtra nada — así
    los llamadores que no evalúan personas no tienen que construirlo.
    """
    items: list[RequisitoAvance] = []
    entidad_vistos: set[str] = set()
    for servicio in servicios:
        for cfg in configs_por_servicio[servicio.id]:
            req = cfg.requisito
            if req.entidad_tipo != entidad_tipo:
                continue
            if trabajador is not None and cargos_por_asignacion is not None:
                cargo_id = cargos_por_asignacion.get((servicio.id, trabajador.id))
                if not _aplica_a_cargo(cfg, cargo_id):
                    continue
            if req.alcance == Alcance.ENTIDAD:
                if str(req.id) in entidad_vistos:
                    continue
                entidad_vistos.add(str(req.id))
                items.append(_item_para(docs, req, None, trabajador=trabajador))
            else:
                items.append(_item_para(docs, req, servicio, trabajador=trabajador))
    return items


def _brecha_de_item(item: RequisitoAvance) -> str | None:
    """Mensaje de brecha legible para el dashboard; None si el item cumple."""
    sufijo = f" ({item.servicio_nombre})" if item.servicio_nombre else ""
    nombre = f"{item.requisito_nombre}{sufijo}"
    if item.estado is None:
        return f"Falta documento: {nombre}"
    if item.estado == EstadoDocumento.ENVIADO:
        return f"{nombre}: pendiente de revisión."
    if item.estado == EstadoDocumento.EN_ANALISIS:
        return f"{nombre}: en análisis."
    if item.estado == EstadoDocumento.OBSERVADO:
        return item.mensaje_brecha or f"{nombre}: observado."
    if item.estado == EstadoDocumento.VENCIDO:
        return f"{nombre}: vencido — renovar."
    if item.estado == EstadoDocumento.PENDIENTE_AUTORIZACION:
        return f"{nombre}: el contratista debe autorizar compartir el documento."
    return None


def _pilar_de_requisito(configs: list[PerfilRequisitoConfig]) -> dict[str, object]:
    return {str(cfg.requisito.id): cfg.requisito.subpilar.pilar for cfg in configs}


def _agrupar_estado_por_pilar(
    configs: list[PerfilRequisitoConfig],
    items: list[RequisitoAvance],
) -> list[EstadoPilar]:
    """Agrupa items en EstadoPilar (cumple + brechas legibles), en orden de pilar."""
    pilar_por_req = _pilar_de_requisito(configs)
    por_pilar: dict[uuid.UUID, tuple] = {}
    for item in items:
        pilar = pilar_por_req[str(item.requisito_id)]
        if pilar.id not in por_pilar:
            por_pilar[pilar.id] = (pilar, [])
        por_pilar[pilar.id][1].append(item)

    resultado = []
    for pilar, pilar_items in sorted(por_pilar.values(), key=lambda t: t[0].orden):
        brechas = [b for b in (_brecha_de_item(i) for i in pilar_items) if b]
        resultado.append(EstadoPilar(
            pilar_codigo=pilar.codigo,
            pilar_nombre=pilar.nombre,
            cumple=len(brechas) == 0,
            brechas=brechas,
            pilar_color=pilar.color,
        ))
    return resultado


def _agrupar_avance_por_pilar(
    configs: list[PerfilRequisitoConfig],
    items: list[RequisitoAvance],
) -> list[PilarAvance]:
    """Agrupa items en PilarAvance (conteos + items completos), en orden de pilar."""
    pilar_por_req = _pilar_de_requisito(configs)
    por_pilar: dict[uuid.UUID, tuple] = {}
    for item in items:
        pilar = pilar_por_req[str(item.requisito_id)]
        if pilar.id not in por_pilar:
            por_pilar[pilar.id] = (pilar, [])
        por_pilar[pilar.id][1].append(item)

    resultado = []
    for pilar, pilar_items in sorted(por_pilar.values(), key=lambda t: t[0].orden):
        aprobados = sum(1 for i in pilar_items if i.estado == EstadoDocumento.APROBADO)
        resultado.append(PilarAvance(
            codigo=pilar.codigo,
            nombre=pilar.nombre,
            total=len(pilar_items),
            aprobados=aprobados,
            cumple=aprobados == len(pilar_items),
            requisitos=pilar_items,
            color=pilar.color,
        ))
    return resultado


def _resumir(items: list[RequisitoAvance]) -> ResumenAvance:
    total = len(items)
    aprobados = sum(1 for i in items if i.estado == EstadoDocumento.APROBADO)
    observados = sum(1 for i in items if i.estado == EstadoDocumento.OBSERVADO)
    en_analisis = sum(1 for i in items if i.estado == EstadoDocumento.EN_ANALISIS)
    enviados = sum(1 for i in items if i.estado == EstadoDocumento.ENVIADO)
    faltantes = sum(1 for i in items if i.estado is None)
    return ResumenAvance(
        total_requisitos=total,
        subidos=total - faltantes,
        aprobados=aprobados,
        observados=observados,
        en_analisis=en_analisis,
        enviados=enviados,
        faltantes=faltantes,
        porcentaje_avance=round(aprobados / total * 100) if total else 0,
    )


# ── Vista por documento (portal del contratista) ──────────────────────────────
#
# El portal del contratista se organiza por DOCUMENTO, no por mandante: un F30
# no es "mi F30 de Codelco", es mi F30 —que Codelco aprobó, Falabella tiene en
# revisión y Anglo ni exige—. Es la vista que hace visible la reutilización de
# Fase 2 y la única forma de que el contratista entienda que subió una vez y le
# sirvió para varios clientes.
#
# Se construye agregando `evaluar_relacion` sobre todos los mandantes: la lógica
# de qué se exige y en qué estado está vive ahí y no se duplica.


@dataclass
class EstadoPorMandante:
    """Cómo juzga UN mandante este documento. Uno por acreditación."""
    mandante_id: uuid.UUID
    mandante_razon_social: str
    estado: int | None                 # None = exigido pero sin subir
    mensaje_brecha: str | None
    documento_id: uuid.UUID | None     # id de la Acreditacion (para historial/descarga)
    numero_version: int | None         # que version tiene fijada: dos mandantes pueden diferir
    fecha_vigencia_hasta: date | None  # de la entrega que ESE mandante tiene fijada


@dataclass
class DocumentoContratista:
    """Un documento del contratista con el estado de cada mandante que lo exige."""
    clave: str
    expediente_id: uuid.UUID | None   # None = exigido pero aún sin subir
    sensible: bool                    # sensibilidad EFECTIVA (override o catálogo)
    sensible_override: bool | None    # decisión del contratista; None = default
    puede_relajar: bool               # False en documentos de trabajador
    requisito_id: uuid.UUID
    requisito_codigo: str
    requisito_nombre: str
    requisito_descripcion: str
    entidad_tipo: str
    alcance: str
    max_archivos: int
    pilar_codigo: str | None
    pilar_nombre: str | None
    trabajador_id: uuid.UUID | None
    trabajador_nombre: str | None
    servicio_id: uuid.UUID | None
    servicio_nombre: str | None
    mandantes: list[EstadoPorMandante] = field(default_factory=list)
    # Lista EFECTIVA de MIME aceptados, con el default global ya resuelto. Va
    # resuelta y no NULL para que el frontend no tenga que conocer el default: el
    # diálogo de subida tenía "application/pdf" cableado y rechazaba las fotos de
    # los 6 requisitos que sí las aceptan.
    formatos_permitidos: list[str] = field(default_factory=list)


def vista_documental(db: Session, contratista_id: uuid.UUID) -> list[DocumentoContratista]:
    """
    Todos los documentos del contratista con su estado ante cada mandante.

    Agrupación: los de alcance ENTIDAD se unifican entre mandantes (es el mismo
    F30 físico); los de alcance SERVICIO nunca, porque el servicio pertenece a un
    solo mandante y el MIPER de Obra Norte no es el de Obra Sur.
    """
    relaciones = db.query(ContratistaMandante).filter_by(contratista_id=contratista_id).all()
    docs: dict[tuple, DocumentoContratista] = {}

    for rel in relaciones:
        evaluacion = evaluar_relacion(db, contratista_id, rel.mandante_id)
        items = list(evaluacion.items_empresa)
        for items_trabajador in evaluacion.items_trabajadores.values():
            items.extend(items_trabajador)

        for item in items:
            clave = (item.requisito_id, item.trabajador_id, item.servicio_id)
            doc = docs.get(clave)
            if doc is None:
                exp = _expediente_del_item(db, item, contratista_id)
                requisito = exp.requisito if exp else None
                doc = DocumentoContratista(
                    clave=f"{item.requisito_id}:{item.trabajador_id or ''}:{item.servicio_id or ''}",
                    expediente_id=exp.id if exp else None,
                    sensible=(reutilizacion_service.es_sensible(exp, requisito)
                              if exp and requisito else False),
                    sensible_override=exp.sensible_override if exp else None,
                    puede_relajar=item.entidad_tipo == EntidadTipo.EMPRESA,
                    requisito_id=item.requisito_id,
                    requisito_codigo=item.requisito_codigo,
                    requisito_nombre=item.requisito_nombre,
                    requisito_descripcion=item.requisito_descripcion,
                    entidad_tipo=item.entidad_tipo,
                    alcance=item.alcance,
                    max_archivos=item.max_archivos,
                    pilar_codigo=item.pilar_codigo,
                    pilar_nombre=item.pilar_nombre,
                    trabajador_id=item.trabajador_id,
                    trabajador_nombre=item.trabajador_nombre,
                    servicio_id=item.servicio_id,
                    servicio_nombre=item.servicio_nombre,
                    formatos_permitidos=item.formatos_permitidos,
                )
                docs[clave] = doc
            doc.mandantes.append(EstadoPorMandante(
                mandante_id=rel.mandante_id,
                mandante_razon_social=rel.mandante.razon_social,
                estado=item.estado,
                mensaje_brecha=item.mensaje_brecha,
                documento_id=item.documento_id,
                numero_version=item.numero_version,
                fecha_vigencia_hasta=item.fecha_vigencia_hasta,
            ))

    for doc in docs.values():
        doc.mandantes.sort(key=lambda m: m.mandante_razon_social)

    # Empresa antes que trabajadores; dentro, por pilar y nombre de requisito.
    return sorted(
        docs.values(),
        key=lambda d: (
            d.entidad_tipo != EntidadTipo.EMPRESA,
            d.trabajador_nombre or "",
            d.pilar_nombre or "",
            d.requisito_nombre,
            d.servicio_nombre or "",
        ),
    )


@dataclass
class ResumenMandante:
    """Fila del dashboard del contratista: cómo va con UN cliente."""
    mandante_id: uuid.UUID
    mandante_razon_social: str
    estado_global: str
    servicios_activos: int
    brechas: list[str] = field(default_factory=list)
    trabajadores_total: int = 0
    trabajadores_ok: int = 0


def resumen_por_mandante(db: Session, contratista_id: uuid.UUID) -> list[ResumenMandante]:
    """
    Una fila por cliente del contratista. Es la respuesta a "¿con quién estoy
    bien y con quién no?", que hoy el dashboard no puede contestar porque está
    cableado a un único mandante elegido arbitrariamente en el token.
    """
    resumenes: list[ResumenMandante] = []
    relaciones = db.query(ContratistaMandante).filter_by(contratista_id=contratista_id).all()

    for rel in relaciones:
        estado = obtener_estado_acreditacion(db, contratista_id, rel.mandante_id)
        brechas = [b for p in estado.pilares_empresa for b in p.brechas]
        for t in estado.trabajadores:
            if not t.cumple:
                brechas.extend(f"{t.nombre}: {b}" for p in t.pilares for b in p.brechas)
        resumenes.append(ResumenMandante(
            mandante_id=rel.mandante_id,
            mandante_razon_social=rel.mandante.razon_social,
            estado_global=estado.estado_global,
            servicios_activos=sum(1 for s in rel.servicios if s.estado == EstadoServicio.ACTIVO),
            brechas=brechas,
            trabajadores_total=len(estado.trabajadores),
            trabajadores_ok=sum(1 for t in estado.trabajadores if t.cumple),
        ))

    # Lo que necesita atención primero: bloqueadas, luego en proceso.
    orden = {
        EstadoAcreditacion.BLOQUEADA: 0,
        EstadoAcreditacion.EN_PROCESO: 1,
        EstadoAcreditacion.PENDIENTE: 2,
        EstadoAcreditacion.ACREDITADA: 3,
    }
    return sorted(resumenes, key=lambda r: (orden.get(r.estado_global, 9), r.mandante_razon_social))


def _expediente_del_item(db: Session, item: RequisitoAvance, contratista_id: uuid.UUID) -> Expediente | None:
    """El expediente detrás de un item de avance, si el contratista ya subió algo."""
    from app.models.expediente import Acreditacion as _A
    if item.documento_id:
        acred = db.get(_A, item.documento_id)
        return acred.expediente if acred else None
    q = db.query(Expediente).filter(
        Expediente.requisito_id == item.requisito_id,
        Expediente.eliminado_en.is_(None),
    )
    q = (q.filter(Expediente.trabajador_id == item.trabajador_id)
         if item.trabajador_id else q.filter(Expediente.empresa_id == contratista_id))
    q = (q.filter(Expediente.servicio_id == item.servicio_id)
         if item.servicio_id else q.filter(Expediente.servicio_id.is_(None)))
    return q.first()


# ── Bandeja unificada de pendientes (portal del contratista) ──────────────────
#
# Todo lo que requiere una acción del contratista, en una sola lista ordenada
# por urgencia. Antes cada tipo vivía en su propia pantalla —o en ninguna— y el
# contratista tenía que recorrer el portal para descubrir qué le faltaba.


@dataclass
class Pendiente:
    """Algo que el contratista debe resolver. `accion` la interpreta la UI."""
    tipo: str              # AUTORIZACION | OBSERVADO | POR_VENCER | TRABAJADOR_INCOMPLETO
    titulo: str
    detalle: str | None
    urgencia: int          # menor = más urgente; ordena la bandeja
    documento_id: uuid.UUID | None = None
    trabajador_id: uuid.UUID | None = None
    servicio_id: uuid.UUID | None = None
    requisito_id: uuid.UUID | None = None
    # Codigo del requisito, para que "Subir correccion" pueda llevar al
    # documento exacto en vez de dejar al contratista en la lista completa.
    requisito_codigo: str | None = None


def pendientes_del_contratista(db: Session, contratista_id: uuid.UUID) -> list[Pendiente]:
    """
    Los cuatro tipos de pendiente, unificados y priorizados.

    Cada uno se enuncia por su CONSECUENCIA, no por su estado técnico: al
    contratista le importa que un trabajador no podrá entrar a la faena, no que
    a un expediente le falte una acreditación.
    """
    from app.domain import reutilizacion_service

    hoy = date.today()
    pendientes: list[Pendiente] = []
    documentos = vista_documental(db, contratista_id)

    # 1. Documentos sensibles esperando autorización — lo más urgente: hay un
    #    cliente detenido esperando una decisión que solo el contratista puede tomar.
    for acred in reutilizacion_service.acreditaciones_pendientes_autorizacion(db, contratista_id):
        exp = acred.expediente
        # De quién es el documento. Sin esto, dos solicitudes de dos personas
        # distintas se leían idénticas —mismo cliente, mismo requisito— y había
        # que autorizar o rechazar a ciegas. La rama OBSERVADO ya lo hacía.
        de_quien = f" de {exp.trabajador.nombre_completo}" if exp.trabajador else ""
        pendientes.append(Pendiente(
            tipo="AUTORIZACION",
            titulo=(f"{acred.mandante.razon_social} quiere revisar "
                    f"tu {exp.requisito.nombre.lower()}{de_quien}"),
            detalle="Lo marcaste como sensible",
            urgencia=0,
            documento_id=acred.id,
            requisito_id=exp.requisito_id,
        ))

    for doc in documentos:
        etiqueta = f" · {doc.trabajador_nombre}" if doc.trabajador_nombre else ""
        for m in doc.mandantes:
            # 2. Observados: el mandante los rechazó y el contratista debe corregir.
            if m.estado == EstadoDocumento.OBSERVADO:
                pendientes.append(Pendiente(
                    tipo="OBSERVADO",
                    titulo=f"{doc.requisito_nombre}{etiqueta} observado por {m.mandante_razon_social}",
                    detalle=m.mensaje_brecha,
                    urgencia=1,
                    documento_id=m.documento_id,
                    trabajador_id=doc.trabajador_id,
                    requisito_id=doc.requisito_id,
                    requisito_codigo=doc.requisito_codigo,
                ))
            # 3. Por vencer: se avisa por cliente porque cada uno puede estar
            #    anclado a una versión distinta, con vigencias distintas.
            elif m.estado == EstadoDocumento.APROBADO and m.fecha_vigencia_hasta:
                dias = (m.fecha_vigencia_hasta - hoy).days
                if 0 <= dias <= 30:
                    if dias == 0:
                        cuando = "hoy"
                    elif dias == 1:
                        cuando = "en 1 día"
                    else:
                        cuando = f"en {dias} días"
                    pendientes.append(Pendiente(
                        tipo="POR_VENCER",
                        titulo=(f"{doc.requisito_nombre}{etiqueta} vence {cuando}"
                                f" · {m.mandante_razon_social}"),
                        detalle=f"Vigente hasta {m.fecha_vigencia_hasta.isoformat()}",
                        urgencia=2 if dias <= 7 else 3,
                        documento_id=m.documento_id,
                        trabajador_id=doc.trabajador_id,
                        requisito_id=doc.requisito_id,
                        requisito_codigo=doc.requisito_codigo,
                    ))

    # 4. Documentos DE LA EMPRESA que la faena exige y no están aprobados.
    #
    #    Faltaba, y su ausencia hacía que la aplicación mintiera. La pantalla de
    #    inicio del contratista pinta una faena en rojo cuando tiene algún
    #    pendiente con `servicio_id`, y hasta acá el único que lo llevaba era
    #    TRABAJADOR_INCOMPLETO. Consecuencia: una faena a la que le faltaban los
    #    seis documentos de empresa —o cualquiera sin dotación asignada todavía—
    #    se mostraba en verde y "Lista para empezar", con 0 % de avance real.
    #
    #    Se agrupa por servicio, igual que el de trabajadores se agrupa por
    #    persona: un pendiente por faena, no uno por documento.
    for servicio, faltantes in _documentos_de_empresa_faltantes(db, contratista_id):
        cliente = servicio.relacion.mandante.razon_social
        if len(faltantes) == 1:
            que_falta = f"falta {faltantes[0].lower()}"
        else:
            que_falta = f"faltan {len(faltantes)} documentos de la empresa"
        pendientes.append(Pendiente(
            tipo="EMPRESA_INCOMPLETA",
            titulo=f"{servicio.nombre}: {que_falta} · {cliente}",
            detalle="La faena no queda habilitada mientras siga pendiente",
            urgencia=1,
            servicio_id=servicio.id,
        ))

    # 5. Trabajadores asignados a un servicio que no cumplen SUS requisitos.
    #    Es el pendiente más operativo: esa persona no entra a la faena.
    for servicio, trabajador, faltantes in _trabajadores_no_habilitados(db, contratista_id):
        # El nombre del servicio se repite entre clientes ("General" en varios),
        # asi que sin el mandante dos pendientes distintos se ven identicos.
        cliente = servicio.relacion.mandante.razon_social
        if len(faltantes) == 1:
            que_falta = f"le falta {faltantes[0].lower()}"
        else:
            que_falta = f"le faltan {len(faltantes)} documentos"
        pendientes.append(Pendiente(
            tipo="TRABAJADOR_INCOMPLETO",
            # Redaccion sin genero: el nombre no dice como se refiere a si misma
            # la persona, y "asignado/asignada" obligaria a adivinarlo.
            titulo=f"{trabajador.nombre_completo}: {que_falta} para {servicio.nombre} · {cliente}",
            detalle="No podrá ingresar mientras siga pendiente",
            urgencia=1,
            trabajador_id=trabajador.id,
            servicio_id=servicio.id,
        ))

    return sorted(pendientes, key=lambda p: (p.urgencia, p.titulo))


def _documentos_de_empresa_faltantes(db: Session, contratista_id: uuid.UUID):
    """
    (servicio, requisitos de EMPRESA que la faena exige y no están aprobados).

    Mismo recorrido que `_trabajadores_no_habilitados` pero sobre los items sin
    `trabajador_id`, que son los de la empresa. Un requisito exigido y nunca
    subido no genera ninguna acreditación, así que no aparecía por ningún otro
    camino: no basta con mirar los documentos existentes, hay que mirar lo que el
    perfil del mandante exige.
    """
    resultado = []
    relaciones = db.query(ContratistaMandante).filter_by(contratista_id=contratista_id).all()
    for rel in relaciones:
        for servicio in rel.servicios:
            if servicio.estado != EstadoServicio.ACTIVO:
                continue
            avance = obtener_avance_servicio(db, servicio.id)
            faltantes = [
                item.requisito_nombre
                for pilar in avance.pilares
                for item in pilar.requisitos
                if not item.trabajador_id and item.estado != EstadoDocumento.APROBADO
            ]
            if faltantes:
                resultado.append((servicio, faltantes))
    return resultado


def _trabajadores_no_habilitados(db: Session, contratista_id: uuid.UUID):
    """(servicio, trabajador, requisitos que le faltan) por cada incumplimiento."""
    resultado = []
    relaciones = db.query(ContratistaMandante).filter_by(contratista_id=contratista_id).all()
    for rel in relaciones:
        for servicio in rel.servicios:
            if servicio.estado != EstadoServicio.ACTIVO:
                continue
            avance = obtener_avance_servicio(db, servicio.id)
            # Se agrupa por trabajador: un pendiente por persona y servicio, no
            # uno por cada documento que le falta.
            faltan: dict[uuid.UUID, list[str]] = {}
            for pilar in avance.pilares:
                for item in pilar.requisitos:
                    if item.trabajador_id and item.estado != EstadoDocumento.APROBADO:
                        faltan.setdefault(item.trabajador_id, []).append(item.requisito_nombre)
            for tid, faltantes in faltan.items():
                trabajador = db.get(Trabajador, tid)
                if trabajador:
                    resultado.append((servicio, trabajador, faltantes))
    return resultado


# ── Habilitación de trabajadores por servicio ─────────────────────────────────


@dataclass
class HabilitacionServicio:
    """Si un trabajador puede ingresar a UN servicio, y qué le falta si no."""
    servicio_id: uuid.UUID
    servicio_nombre: str
    mandante_razon_social: str
    # None en los servicios anteriores a los centros de trabajo.
    centro_trabajo_nombre: str | None
    habilitado: bool
    faltantes: list[str] = field(default_factory=list)


@dataclass
class TrabajadorHabilitacion:
    trabajador_id: uuid.UUID
    nombre_completo: str
    rut: str
    cargo: str | None
    activo: bool
    servicios: list[HabilitacionServicio] = field(default_factory=list)


def habilitacion_trabajadores(db: Session, contratista_id: uuid.UUID) -> list[TrabajadorHabilitacion]:
    """
    Por cada trabajador, si puede ingresar a cada servicio al que está asignado.

    La habilitación es POR SERVICIO, no por mandante: dos servicios del mismo
    cliente pueden referenciar perfiles distintos, y los requisitos de alcance
    SERVICIO son específicos de cada faena. Un trabajador puede estar habilitado
    en una obra y bloqueado en otra del mismo mandante.
    """
    trabajadores = {
        t.id: TrabajadorHabilitacion(
            trabajador_id=t.id, nombre_completo=t.nombre_completo, rut=t.rut,
            cargo=t.cargo, activo=t.activo,
        )
        for t in db.query(Trabajador).filter_by(empresa_id=contratista_id).all()
    }

    for rel in db.query(ContratistaMandante).filter_by(contratista_id=contratista_id).all():
        for servicio in rel.servicios:
            if servicio.estado != EstadoServicio.ACTIVO:
                continue
            avance = obtener_avance_servicio(db, servicio.id)
            faltan_por_trabajador: dict[uuid.UUID, list[str]] = {}
            for pilar in avance.pilares:
                for item in pilar.requisitos:
                    if not item.trabajador_id:
                        continue
                    if item.estado != EstadoDocumento.APROBADO:
                        faltan_por_trabajador.setdefault(item.trabajador_id, []).append(
                            item.requisito_nombre
                        )
            # La dotación sale de las ASIGNACIONES, no de los items. Deducirla de
            # los items hacía desaparecer a quien no tuviera ninguno —posible
            # desde que existe el filtro por cargo— y la pantalla le decía "no
            # está asignado a ningún servicio" a alguien que sí lo estaba.
            sin_requisitos = {t.trabajador_id for t in avance.trabajadores if t.sin_requisitos}
            for tid in (t.trabajador_id for t in avance.trabajadores):
                if tid not in trabajadores:
                    continue
                faltantes = faltan_por_trabajador.get(tid, [])
                if tid in sin_requisitos:
                    # No evaluable: el perfil no le exige nada para su cargo. Se
                    # reporta como brecha para que alguien lo mire, en vez de
                    # dejarlo pasar en silencio.
                    faltantes = ["Su cargo no tiene requisitos configurados en este perfil"]
                trabajadores[tid].servicios.append(HabilitacionServicio(
                    servicio_id=servicio.id,
                    servicio_nombre=servicio.nombre,
                    mandante_razon_social=rel.mandante.razon_social,
                    centro_trabajo_nombre=(
                        servicio.centro_trabajo.nombre if servicio.centro_trabajo else None
                    ),
                    habilitado=not faltantes,
                    faltantes=faltantes,
                ))

    # Los bloqueados primero: son los que necesitan acción.
    return sorted(
        trabajadores.values(),
        key=lambda t: (not any(not s.habilitado for s in t.servicios), t.nombre_completo),
    )


# ── Riesgo del mandante ───────────────────────────────────────────────────────
#
# El mandante responde ante la Ley 20.123 por lo que pasa en su faena. Su
# dashboard no debe contarle cuántos contratistas tiene —dato de vanidad— sino
# dónde está expuesto: quién está trabajando sin cumplir y qué espera su revisión.


@dataclass
class ServicioEnRiesgo:
    servicio_id: uuid.UUID
    servicio_nombre: str
    contratista_razon_social: str
    trabajadores_asignados: int
    trabajadores_no_habilitados: int
    documentos_pendientes: int
    brechas_empresa: list[str] = field(default_factory=list)


@dataclass
class RiesgoMandante:
    total_servicios: int
    servicios_en_riesgo: int
    personas_no_habilitadas: int
    documentos_por_revisar: int
    servicios: list[ServicioEnRiesgo] = field(default_factory=list)


def riesgo_del_mandante(db: Session, mandante_id: uuid.UUID) -> RiesgoMandante:
    """
    Dónde está expuesto el mandante, por faena.

    La unidad es el servicio y no el contratista: una empresa puede estar
    impecable en una obra y tener gente sin habilitar en otra. Agrupar por
    contratista escondería justamente el lugar donde hay riesgo.
    """
    servicios: list[ServicioEnRiesgo] = []
    relaciones = db.query(ContratistaMandante).filter_by(mandante_id=mandante_id).all()

    for rel in relaciones:
        for servicio in rel.servicios:
            if servicio.estado != EstadoServicio.ACTIVO:
                continue
            avance = obtener_avance_servicio(db, servicio.id)

            no_habilitados: set[uuid.UUID] = set()
            # La dotación son las personas ASIGNADAS, no las que tienen items.
            # Deducirla de los items subcontaba la faena en cuanto el filtro por
            # cargo dejaba a alguien sin ninguno, y el dashboard declaraba menos
            # gente de la que hay en terreno.
            asignados: set[uuid.UUID] = {t.trabajador_id for t in avance.trabajadores}
            # No evaluable cuenta como NO habilitado: es lo que obliga a mirarlo.
            no_habilitados |= {t.trabajador_id for t in avance.trabajadores if t.sin_requisitos}
            pendientes = 0
            brechas_empresa: list[str] = []

            for pilar in avance.pilares:
                for item in pilar.requisitos:
                    if item.estado in (EstadoDocumento.ENVIADO, EstadoDocumento.EN_ANALISIS):
                        pendientes += 1
                    if item.trabajador_id:
                        if item.estado != EstadoDocumento.APROBADO:
                            no_habilitados.add(item.trabajador_id)
                    elif item.estado != EstadoDocumento.APROBADO:
                        brechas_empresa.append(item.requisito_nombre)

            servicios.append(ServicioEnRiesgo(
                servicio_id=servicio.id,
                servicio_nombre=servicio.nombre,
                contratista_razon_social=rel.contratista.razon_social,
                trabajadores_asignados=len(asignados),
                trabajadores_no_habilitados=len(no_habilitados),
                documentos_pendientes=pendientes,
                brechas_empresa=brechas_empresa,
            ))

    def en_riesgo(s: ServicioEnRiesgo) -> bool:
        return s.trabajadores_no_habilitados > 0 or bool(s.brechas_empresa)

    # Lo más expuesto primero: más gente sin habilitar arriba.
    servicios.sort(key=lambda s: (-s.trabajadores_no_habilitados, -len(s.brechas_empresa),
                                  s.contratista_razon_social))

    return RiesgoMandante(
        total_servicios=len(servicios),
        servicios_en_riesgo=sum(1 for s in servicios if en_riesgo(s)),
        personas_no_habilitadas=sum(s.trabajadores_no_habilitados for s in servicios),
        documentos_por_revisar=sum(s.documentos_pendientes for s in servicios),
        servicios=servicios,
    )
