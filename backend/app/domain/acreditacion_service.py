import uuid
from collections import defaultdict
from dataclasses import dataclass, field

from sqlalchemy.orm import Session, joinedload

from app.models.contratista import ContratistaMandante
from app.models.documento import Documento
from app.models.mandante import MandanteRequisitoConfig
from app.models.pilar import RequisitoDocumental, Subpilar
from app.models.trabajador import Trabajador


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


def obtener_estado_acreditacion(
    db: Session,
    contratista_id: uuid.UUID,
    mandante_id: uuid.UUID,
) -> ResultadoAcreditacion:
    """
    Consolida el estado de acreditación completo de una empresa
    ante un mandante específico.

    Los pilares evaluados son SOLO los que el mandante configuró como obligatorios.
    Si un mandante no configura ningún requisito de un pilar, ese pilar no aparece.
    Esto permite que cada mandante defina su propio conjunto de exigencias sobre
    el catálogo global de pilares y requisitos.
    """
    # Carga la configuración del mandante con toda la cadena de relaciones:
    # MandanteRequisitoConfig → RequisitoDocumental → Subpilar → Pilar
    configs = (
        db.query(MandanteRequisitoConfig)
        .filter_by(mandante_id=mandante_id, es_obligatorio=True)
        .options(
            joinedload(MandanteRequisitoConfig.requisito)
            .joinedload(RequisitoDocumental.subpilar)
            .joinedload(Subpilar.pilar)
        )
        .all()
    )

    # Separar configuraciones por tipo de entidad
    configs_empresa = [c for c in configs if c.requisito.entidad_tipo == "EMPRESA"]
    configs_trabajador = [c for c in configs if c.requisito.entidad_tipo == "TRABAJADOR"]

    # Documentos más recientes por requisito para la empresa (un dict req_id → Documento)
    docs_empresa = _ultimo_doc_por_requisito(
        db.query(Documento)
        .filter_by(empresa_id=contratista_id, mandante_id=mandante_id)
        .order_by(Documento.created_at.desc())
        .all()
    )

    pilares_empresa = _evaluar_pilares(configs_empresa, docs_empresa)

    # Evaluar trabajadores activos
    trabajadores = (
        db.query(Trabajador)
        .filter_by(empresa_id=contratista_id, activo=True)
        .all()
    )
    resultado_trabajadores = []
    for t in trabajadores:
        docs_t = _ultimo_doc_por_requisito(
            db.query(Documento)
            .filter_by(trabajador_id=t.id, mandante_id=mandante_id)
            .order_by(Documento.created_at.desc())
            .all()
        )
        pilares_t = _evaluar_pilares(configs_trabajador, docs_t)
        resultado_trabajadores.append(EstadoTrabajador(
            trabajador_id=t.id,
            nombre=t.nombre_completo,
            rut=t.rut,
            cumple=all(p.cumple for p in pilares_t),
            pilares=pilares_t,
        ))

    rel = db.query(ContratistaMandante).filter_by(
        contratista_id=contratista_id, mandante_id=mandante_id
    ).first()
    estado_global = rel.estado_acreditacion if rel else "EN_PROCESO"

    return ResultadoAcreditacion(
        contratista_id=contratista_id,
        mandante_id=mandante_id,
        estado_global=estado_global,
        pilares_empresa=pilares_empresa,
        trabajadores=resultado_trabajadores,
    )


def recalcular_estado_global(
    db: Session,
    contratista_id: uuid.UUID,
    mandante_id: uuid.UUID,
) -> str:
    """
    Recalcula y persiste el estado global en contratistas_mandantes.
    Llamado por el worker Celery tras cada cambio de estado de documento.
    """
    resultado = obtener_estado_acreditacion(db, contratista_id, mandante_id)

    empresa_cumple = all(p.cumple for p in resultado.pilares_empresa)
    trabajadores_cumplen = all(t.cumple for t in resultado.trabajadores)

    if empresa_cumple and trabajadores_cumplen:
        nuevo_estado = "ACREDITADA"
    elif not empresa_cumple:
        nuevo_estado = "BLOQUEADA"
    else:
        nuevo_estado = "EN_PROCESO"

    rel = db.query(ContratistaMandante).filter_by(
        contratista_id=contratista_id, mandante_id=mandante_id
    ).first()
    if rel:
        rel.estado_acreditacion = nuevo_estado
        db.commit()

    return nuevo_estado


# ── Helpers privados ──────────────────────────────────────────────────────────

def _ultimo_doc_por_requisito(documentos: list[Documento]) -> dict[str, Documento]:
    """Devuelve el documento más reciente por requisito_id (los docs ya vienen ordenados desc)."""
    resultado: dict[str, Documento] = {}
    for doc in documentos:
        key = str(doc.requisito_id)
        if key not in resultado:
            resultado[key] = doc
    return resultado


def _evaluar_pilares(
    configs: list[MandanteRequisitoConfig],
    docs: dict[str, Documento],
) -> list[EstadoPilar]:
    """
    Agrupa las configuraciones del mandante por pilar y evalúa cada una.

    Solo muestra pilares para los que el mandante configuró al menos un requisito.
    El orden de los pilares respeta el campo `orden` del modelo Pilar.
    """
    # Agrupar configs por pilar, preservando el orden del pilar
    por_pilar: dict[uuid.UUID, tuple] = {}  # pilar_id → (Pilar, [configs])
    for cfg in configs:
        pilar = cfg.requisito.subpilar.pilar
        if pilar.id not in por_pilar:
            por_pilar[pilar.id] = (pilar, [])
        por_pilar[pilar.id][1].append(cfg)

    # Ordenar por el campo orden del pilar
    pilares_ordenados = sorted(por_pilar.values(), key=lambda t: t[0].orden)

    resultado = []
    for pilar, cfgs in pilares_ordenados:
        brechas = []
        for cfg in cfgs:
            req = cfg.requisito
            doc = docs.get(str(req.id))
            if not doc:
                brechas.append(f"Falta documento: {req.nombre}")
            elif doc.estado == 2:
                brechas.append(f"{req.nombre}: en análisis.")
            elif doc.estado != 4:
                msg = doc.mensaje_brecha or f"{req.nombre}: no aprobado."
                brechas.append(msg)

        resultado.append(EstadoPilar(
            pilar_codigo=pilar.codigo,
            pilar_nombre=pilar.nombre,
            cumple=len(brechas) == 0,
            brechas=brechas,
        ))

    return resultado
