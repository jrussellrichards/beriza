"""
Reutilización documental entre mandantes (Fase 2).

Cuando un mandante empieza a exigir un requisito de alcance ENTIDAD que el
contratista ya tiene resuelto (un F30, un examen médico), se crea la Acreditación
faltante reutilizando el documento existente, sin re-subirlo:

  - requisito genérico  -> Acreditación ENVIADO apuntando a la entrega vigente
    (el mandante la revisa con su propia config; nunca pre-aprobada).
  - requisito sensible  -> Acreditación PENDIENTE_AUTORIZACION, sin compartir el
    archivo, hasta que el contratista autorice explícitamente.

Los requisitos de alcance SERVICIO no se reutilizan entre mandantes (son
específicos de cada faena). Se dispara al crear un servicio (ver servicio_service).
"""
import uuid
from datetime import date, datetime, timezone

from sqlalchemy.orm import Session

from app.core.exceptions import DocumentoNoEncontrado, EstadoDocumentoInvalido
from app.domain.estados import (
    Alcance, EntidadTipo, EstadoDocumento, EstadoServicio, TipoEvento, validar_transicion,
)
from app.models.contratista import ContratistaMandante
from app.models.expediente import Acreditacion, AcreditacionEvento, Entrega, Expediente
from app.models.servicio import PerfilRequisitoConfig
from app.models.trabajador import Trabajador


def reconciliar_reutilizacion(
    db: Session, contratista_id: uuid.UUID, mandante_id: uuid.UUID
) -> list[Acreditacion]:
    """
    Crea las acreditaciones que faltan para el mandante reutilizando los
    expedientes ENTIDAD vigentes del contratista. Devuelve las creadas.
    """
    hoy = date.today()
    creadas: list[Acreditacion] = []
    for req in _requisitos_exigidos_entidad(db, contratista_id, mandante_id):
        for exp in _expedientes_de(db, req, contratista_id):
            vigente = _entrega_vigente(exp, req, hoy)
            if vigente is None:
                continue  # sin nada vigente que reutilizar: queda como brecha
            # Sin filtrar eliminado_en: si el contratista ya rechazó compartir
            # este expediente con este mandante, no se le vuelve a proponer.
            ya_existe = (
                db.query(Acreditacion)
                .filter_by(expediente_id=exp.id, mandante_id=mandante_id)
                .first()
            )
            if ya_existe:
                continue
            creadas.append(_crear_reutilizada(db, exp, mandante_id, req, vigente))
    if creadas:
        db.commit()
    return creadas


def reconciliar_todos_los_mandantes(
    db: Session, contratista_id: uuid.UUID, excepto_mandante_id: uuid.UUID | None = None
) -> dict[uuid.UUID, list[Acreditacion]]:
    """
    Aplica el documento recién subido a TODOS los mandantes del contratista, no
    solo a aquel para el que lo subió: es la promesa del modelo ("se sube una
    vez y vale para todos"). Sin esto, un F30 subido para Codelco nunca llegaría
    a Falabella, que ya tiene servicio y lo exige igual.

    No mueve acreditaciones existentes: `reconciliar_reutilizacion` las salta, así
    que un mandante que ya aprobó la v1 sigue anclado a la v1 hasta que su
    vigencia expire (ahí actúa el auto-repin del cron). El pin es explícito.

    `excepto_mandante_id` omite al mandante que ya se atendió en el upload.
    """
    resultado: dict[uuid.UUID, list[Acreditacion]] = {}
    relaciones = db.query(ContratistaMandante).filter_by(contratista_id=contratista_id).all()
    for rel in relaciones:
        if excepto_mandante_id and rel.mandante_id == excepto_mandante_id:
            continue
        creadas = reconciliar_reutilizacion(db, contratista_id, rel.mandante_id)
        if creadas:
            resultado[rel.mandante_id] = creadas
    return resultado


def autorizar_compartir(db: Session, acreditacion_id: uuid.UUID, usuario_id: uuid.UUID) -> None:
    """El contratista autoriza compartir un documento sensible: fija la entrega
    vigente y pasa a ENVIADO (queda a revisión del mandante)."""
    acred = db.get(Acreditacion, acreditacion_id)
    if not acred or acred.eliminado_en is not None:
        raise DocumentoNoEncontrado(f"Acreditación {acreditacion_id} no encontrada.")
    if acred.estado != EstadoDocumento.PENDIENTE_AUTORIZACION:
        raise EstadoDocumentoInvalido("La acreditación no está pendiente de autorización.")
    exp = acred.expediente
    # Se comparte lo vigente AL AUTORIZAR, no lo que había al solicitarse: entre
    # ambos momentos el contratista pudo renovar el documento.
    vigente = _entrega_vigente(exp, exp.requisito, date.today())
    if vigente is None:
        raise EstadoDocumentoInvalido(
            "El documento no tiene una versión vigente para compartir. Sube una renovación."
        )

    validar_transicion(acred.estado, EstadoDocumento.ENVIADO)
    acred.entrega_id = vigente.id
    acred.numero_version = vigente.numero_version
    acred.estado = EstadoDocumento.ENVIADO
    db.add(AcreditacionEvento(
        acreditacion_id=acred.id, tipo_evento=TipoEvento.AUTORIZACION_COMPARTIR,
        estado_anterior=EstadoDocumento.PENDIENTE_AUTORIZACION, estado_nuevo=EstadoDocumento.ENVIADO,
        actor_usuario_id=usuario_id, detalle=None,
    ))
    db.commit()


def rechazar_compartir(db: Session, acreditacion_id: uuid.UUID, usuario_id: uuid.UUID) -> None:
    """El contratista rechaza compartir un documento sensible: la acreditación
    reutilizada se descarta. El requisito queda como brecha para ese mandante
    hasta que el contratista suba el documento explícitamente. No se vuelve a
    proponer automáticamente (reconciliar_reutilizacion respeta el rechazo)."""
    acred = db.get(Acreditacion, acreditacion_id)
    if not acred or acred.eliminado_en is not None:
        raise DocumentoNoEncontrado(f"Acreditación {acreditacion_id} no encontrada.")
    if acred.estado != EstadoDocumento.PENDIENTE_AUTORIZACION:
        raise EstadoDocumentoInvalido("La acreditación no está pendiente de autorización.")

    acred.eliminado_en = datetime.now(timezone.utc)
    db.add(AcreditacionEvento(
        acreditacion_id=acred.id, tipo_evento=TipoEvento.ELIMINACION,
        estado_anterior=EstadoDocumento.PENDIENTE_AUTORIZACION, estado_nuevo=None,
        actor_usuario_id=usuario_id, detalle={"rechazo_compartir": True},
    ))
    db.commit()


def acreditaciones_pendientes_autorizacion(db: Session, contratista_id: uuid.UUID) -> list[Acreditacion]:
    """Solicitudes de acceso a documentos sensibles del contratista (bandeja)."""
    empresa_expedientes = db.query(Expediente.id).filter_by(empresa_id=contratista_id)
    trab_ids = [t.id for t in db.query(Trabajador).filter_by(empresa_id=contratista_id).all()]
    trab_expedientes = db.query(Expediente.id).filter(Expediente.trabajador_id.in_(trab_ids)) if trab_ids else None
    exp_ids = [e[0] for e in empresa_expedientes.all()]
    if trab_expedientes is not None:
        exp_ids += [e[0] for e in trab_expedientes.all()]
    if not exp_ids:
        return []
    return (
        db.query(Acreditacion)
        .filter(
            Acreditacion.expediente_id.in_(exp_ids),
            Acreditacion.estado == EstadoDocumento.PENDIENTE_AUTORIZACION,
            Acreditacion.eliminado_en.is_(None),
        )
        .all()
    )


def es_sensible(exp: Expediente, req) -> bool:
    """
    Sensibilidad efectiva: la decisión del contratista pisa el default del
    catálogo, salvo que intente relajar un documento de un trabajador.
    """
    if exp.sensible_override is None:
        return req.sensible
    if exp.sensible_override is False and req.entidad_tipo == EntidadTipo.TRABAJADOR:
        # Relajar datos de un tercero no es suyo para decidir. Se ignora el
        # override y manda el catálogo. La API lo rechaza antes de llegar acá;
        # esto cubre datos ya persistidos o cambios de entidad_tipo posteriores.
        return req.sensible
    return exp.sensible_override


def definir_sensibilidad(
    db: Session, expediente_id: uuid.UUID, contratista_id: uuid.UUID, sensible: bool | None
) -> Expediente:
    """
    El contratista decide si este documento suyo se comparte sin preguntar.
    `None` vuelve al default del catálogo.

    Relajar (False) solo se permite en documentos de entidad EMPRESA: el
    contenido de un documento de trabajador es dato personal de un tercero.
    """
    exp = db.get(Expediente, expediente_id)
    if not exp or exp.eliminado_en is not None:
        raise DocumentoNoEncontrado(f"Expediente {expediente_id} no encontrado.")

    dueño_id = exp.empresa_id or (exp.trabajador.empresa_id if exp.trabajador_id else None)
    if dueño_id != contratista_id:
        raise DocumentoNoEncontrado(f"Expediente {expediente_id} no encontrado.")

    if sensible is False and exp.requisito.entidad_tipo == EntidadTipo.TRABAJADOR:
        raise EstadoDocumentoInvalido(
            "Este documento contiene datos personales de un trabajador. Puedes exigir "
            "autorización para compartirlo, pero no puedes renunciar a esa protección "
            "en su nombre."
        )

    exp.sensible_override = sensible
    db.commit()
    db.refresh(exp)
    return exp


def _requisitos_exigidos_entidad(db, contratista_id, mandante_id):
    rel = (
        db.query(ContratistaMandante)
        .filter_by(contratista_id=contratista_id, mandante_id=mandante_id)
        .first()
    )
    if not rel:
        return []
    servicios = [s for s in rel.servicios if s.estado == EstadoServicio.ACTIVO]
    reqs = {}
    for s in servicios:
        configs = db.query(PerfilRequisitoConfig).filter_by(
            perfil_id=s.perfil_requisitos_id, es_obligatorio=True
        ).all()
        for cfg in configs:
            if cfg.requisito.alcance == Alcance.ENTIDAD:
                reqs[cfg.requisito.id] = cfg.requisito
    return list(reqs.values())


def _expedientes_de(db, req, contratista_id):
    if req.entidad_tipo == EntidadTipo.EMPRESA:
        query = db.query(Expediente).filter_by(
            requisito_id=req.id, empresa_id=contratista_id, servicio_id=None, eliminado_en=None
        )
    else:
        trab_ids = [t.id for t in db.query(Trabajador).filter_by(empresa_id=contratista_id, activo=True).all()]
        if not trab_ids:
            return []
        query = db.query(Expediente).filter(
            Expediente.requisito_id == req.id,
            Expediente.trabajador_id.in_(trab_ids),
            Expediente.servicio_id.is_(None),
            Expediente.eliminado_en.is_(None),
        )
    return query.all()


def _entrega_vigente(exp, req, hoy: date) -> Entrega | None:
    """
    Última entrega que aún sirve para acreditar. Un documento caducado no se
    reutiliza: compartirlo solo produciría una observación en el mandante nuevo.
    Vigencia nula = todavía sin revisar, no hay fecha que haya expirado.
    """
    for entrega in reversed(exp.entregas):   # entregas viene ordenada por versión
        if (req.sin_vencimiento
                or entrega.fecha_vigencia_hasta is None
                or entrega.fecha_vigencia_hasta >= hoy):
            return entrega
    return None


def _crear_reutilizada(db, exp, mandante_id, req, vigente: Entrega) -> Acreditacion:
    if es_sensible(exp, req):
        acred = Acreditacion(
            mandante_id=mandante_id, expediente_id=exp.id,
            estado=EstadoDocumento.PENDIENTE_AUTORIZACION,
        )
        estado_nuevo = EstadoDocumento.PENDIENTE_AUTORIZACION
        detalle = {"sensible": True}
    else:
        acred = Acreditacion(
            mandante_id=mandante_id, expediente_id=exp.id, entrega_id=vigente.id,
            numero_version=vigente.numero_version, estado=EstadoDocumento.ENVIADO,
        )
        estado_nuevo = EstadoDocumento.ENVIADO
        detalle = {"version": vigente.numero_version}
    db.add(acred)
    db.flush()
    db.add(AcreditacionEvento(
        acreditacion_id=acred.id, tipo_evento=TipoEvento.REUTILIZACION,
        estado_anterior=None, estado_nuevo=estado_nuevo, actor_usuario_id=None, detalle=detalle,
    ))
    return acred
