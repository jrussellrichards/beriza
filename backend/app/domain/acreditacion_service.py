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

    docs_empresa = _acreds_por_clave(_acreds_de_entidad(db, mandante_id, empresa_id=empresa_id))

    items: list[RequisitoAvance] = []
    for cfg in configs_empresa:
        items.append(_item_para(docs_empresa, cfg.requisito, servicio))

    avance_trabajadores: list[TrabajadorAvance] = []
    for t in trabajadores:
        docs_t = _acreds_por_clave(_acreds_de_entidad(db, mandante_id, trabajador_id=t.id))
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
    for a in asignaciones:
        if not a.trabajador.activo:
            continue
        servicios_por_trabajador.setdefault(a.trabajador_id, set()).add(a.servicio_id)
        trabajadores[a.trabajador_id] = a.trabajador

    for t in trabajadores.values():
        docs_t = _acreds_por_clave(_acreds_de_entidad(db, mandante_id, trabajador_id=t.id))
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
        entidad_tipo=requisito.entidad_tipo,
        alcance=requisito.alcance,
        estado=acred.estado if acred else None,
        fecha_vigencia_hasta=vigencia,
        mensaje_brecha=acred.mensaje_brecha if acred else None,
        documento_id=acred.id if acred else None,
        trabajador_id=trabajador.id if trabajador else None,
        trabajador_nombre=trabajador.nombre_completo if trabajador else None,
        servicio_id=servicio.id if es_por_servicio else None,
        servicio_nombre=servicio.nombre if es_por_servicio else None,
    )


def _items_de_entidad(
    docs: dict[tuple[str, str | None], Acreditacion],
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
    fecha_vigencia_hasta: date | None  # de la entrega que ESE mandante tiene fijada


@dataclass
class DocumentoContratista:
    """Un documento del contratista con el estado de cada mandante que lo exige."""
    clave: str
    requisito_id: uuid.UUID
    requisito_codigo: str
    requisito_nombre: str
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
                doc = DocumentoContratista(
                    clave=f"{item.requisito_id}:{item.trabajador_id or ''}:{item.servicio_id or ''}",
                    requisito_id=item.requisito_id,
                    requisito_codigo=item.requisito_codigo,
                    requisito_nombre=item.requisito_nombre,
                    entidad_tipo=item.entidad_tipo,
                    alcance=item.alcance,
                    max_archivos=item.max_archivos,
                    pilar_codigo=item.pilar_codigo,
                    pilar_nombre=item.pilar_nombre,
                    trabajador_id=item.trabajador_id,
                    trabajador_nombre=item.trabajador_nombre,
                    servicio_id=item.servicio_id,
                    servicio_nombre=item.servicio_nombre,
                )
                docs[clave] = doc
            doc.mandantes.append(EstadoPorMandante(
                mandante_id=rel.mandante_id,
                mandante_razon_social=rel.mandante.razon_social,
                estado=item.estado,
                mensaje_brecha=item.mensaje_brecha,
                documento_id=item.documento_id,
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
