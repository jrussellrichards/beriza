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

from app.core.exceptions import ServicioNoEncontrado
from app.domain.estados import (
    Alcance,
    EntidadTipo,
    EstadoAcreditacion,
    EstadoDocumento,
    EstadoServicio,
)
from app.models.contratista import ContratistaMandante
from app.models.documento import Documento
from app.models.pilar import RequisitoDocumental, Subpilar
from app.models.servicio import PerfilRequisitoConfig, Servicio, ServicioTrabajador
from app.models.trabajador import Trabajador


# ── Dataclasses de resultado ──────────────────────────────────────────────────

@dataclass
class RequisitoAvance:
    requisito_id: uuid.UUID
    requisito_codigo: str
    requisito_nombre: str
    entidad_tipo: str
    alcance: str
    estado: int | None            # None = documento no subido aún
    fecha_vigencia_hasta: date | None
    mensaje_brecha: str | None
    documento_id: uuid.UUID | None
    trabajador_id: uuid.UUID | None = None
    trabajador_nombre: str | None = None
    servicio_id: uuid.UUID | None = None
    servicio_nombre: str | None = None
    pilar_codigo: str | None = None
    pilar_nombre: str | None = None
    # Config de entrega del catálogo, para que el frontend arme la subida
    max_archivos: int = 1


@dataclass
class PilarAvance:
    codigo: str
    nombre: str
    total: int
    aprobados: int
    cumple: bool
    requisitos: list[RequisitoAvance] = field(default_factory=list)


@dataclass
class TrabajadorAvance:
    trabajador_id: uuid.UUID
    nombre: str
    rut: str
    cargo: str | None
    total: int
    aprobados: int
    cumple: bool


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

    configs = _configs_de_perfil(db, servicio.perfil_requisitos_id)
    configs_empresa = [c for c in configs if c.requisito.entidad_tipo == EntidadTipo.EMPRESA]
    configs_trabajador = [c for c in configs if c.requisito.entidad_tipo == EntidadTipo.TRABAJADOR]

    trabajadores = _trabajadores_asignados(db, [servicio_id])

    docs_empresa = _docs_por_requisito_y_servicio(
        db.query(Documento)
        .filter_by(empresa_id=empresa_id, mandante_id=mandante_id, eliminado_en=None)
        .all()
    )

    items: list[RequisitoAvance] = []
    for cfg in configs_empresa:
        items.append(_item_para(docs_empresa, cfg.requisito, servicio))

    avance_trabajadores: list[TrabajadorAvance] = []
    for t in trabajadores:
        docs_t = _docs_por_requisito_y_servicio(
            db.query(Documento)
            .filter_by(trabajador_id=t.id, mandante_id=mandante_id, eliminado_en=None)
            .all()
        )
        items_t = [
            _item_para(docs_t, cfg.requisito, servicio, trabajador=t)
            for cfg in configs_trabajador
        ]
        items.extend(items_t)
        aprobados_t = sum(1 for i in items_t if i.estado == EstadoDocumento.APROBADO)
        avance_trabajadores.append(TrabajadorAvance(
            trabajador_id=t.id, nombre=t.nombre_completo, rut=t.rut, cargo=t.cargo,
            total=len(items_t), aprobados=aprobados_t, cumple=aprobados_t == len(items_t),
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
    configs_por_servicio: dict[uuid.UUID, list[PerfilRequisitoConfig]] = {
        s.id: _configs_de_perfil(db, s.perfil_requisitos_id) for s in servicios_activos
    }
    todas_configs: list[PerfilRequisitoConfig] = [
        c for cfgs in configs_por_servicio.values() for c in cfgs
    ]

    docs_empresa = _docs_por_requisito_y_servicio(
        db.query(Documento)
        .filter_by(empresa_id=contratista_id, mandante_id=mandante_id, eliminado_en=None)
        .all()
    )

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
    for a in asignaciones:
        if not a.trabajador.activo:
            continue
        servicios_por_trabajador.setdefault(a.trabajador_id, set()).add(a.servicio_id)
        trabajadores[a.trabajador_id] = a.trabajador

    for t in trabajadores.values():
        docs_t = _docs_por_requisito_y_servicio(
            db.query(Documento)
            .filter_by(trabajador_id=t.id, mandante_id=mandante_id, eliminado_en=None)
            .all()
        )
        servicios_del_t = [
            s for s in servicios_activos if s.id in servicios_por_trabajador[t.id]
        ]
        items_t = _items_de_entidad(
            docs_t, servicios_del_t, configs_por_servicio, EntidadTipo.TRABAJADOR, trabajador=t
        )
        pilares_t = _agrupar_estado_por_pilar(todas_configs, items_t)
        evaluacion.items_trabajadores[str(t.id)] = items_t
        evaluacion.trabajadores.append(EstadoTrabajador(
            trabajador_id=t.id,
            nombre=t.nombre_completo,
            rut=t.rut,
            cumple=all(p.cumple for p in pilares_t),
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


def _docs_por_requisito_y_servicio(documentos: list[Documento]) -> dict[tuple[str, str | None], Documento]:
    """
    Indexa expedientes vivos por (requisito_id, servicio_id|None).
    La identidad única está garantizada por los índices parciales de BD.
    """
    return {
        (str(d.requisito_id), str(d.servicio_id) if d.servicio_id else None): d
        for d in documentos
    }


def _item_para(
    docs: dict[tuple[str, str | None], Documento],
    requisito: RequisitoDocumental,
    servicio: Servicio | None,
    trabajador: Trabajador | None = None,
) -> RequisitoAvance:
    """Item de avance para un requisito: busca el expediente según su alcance."""
    es_por_servicio = requisito.alcance == Alcance.SERVICIO and servicio is not None
    clave = (str(requisito.id), str(servicio.id) if es_por_servicio else None)
    doc = docs.get(clave)
    pilar = requisito.subpilar.pilar
    return RequisitoAvance(
        pilar_codigo=pilar.codigo,
        pilar_nombre=pilar.nombre,
        max_archivos=requisito.max_archivos,
        requisito_id=requisito.id,
        requisito_codigo=requisito.codigo,
        requisito_nombre=requisito.nombre,
        entidad_tipo=requisito.entidad_tipo,
        alcance=requisito.alcance,
        estado=doc.estado if doc else None,
        fecha_vigencia_hasta=doc.fecha_vigencia_hasta if doc else None,
        mensaje_brecha=doc.mensaje_brecha if doc else None,
        documento_id=doc.id if doc else None,
        trabajador_id=trabajador.id if trabajador else None,
        trabajador_nombre=trabajador.nombre_completo if trabajador else None,
        servicio_id=servicio.id if es_por_servicio else None,
        servicio_nombre=servicio.nombre if es_por_servicio else None,
    )


def _items_de_entidad(
    docs: dict[tuple[str, str | None], Documento],
    servicios: list[Servicio],
    configs_por_servicio: dict[uuid.UUID, list[PerfilRequisitoConfig]],
    entidad_tipo: str,
    trabajador: Trabajador | None = None,
) -> list[RequisitoAvance]:
    """
    Items de una entidad (empresa o trabajador) para varios servicios:
    alcance ENTIDAD → un solo item (deduplicado entre perfiles);
    alcance SERVICIO → un item por cada servicio cuyo perfil lo exige.
    """
    items: list[RequisitoAvance] = []
    entidad_vistos: set[str] = set()
    for servicio in servicios:
        for cfg in configs_por_servicio[servicio.id]:
            req = cfg.requisito
            if req.entidad_tipo != entidad_tipo:
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
