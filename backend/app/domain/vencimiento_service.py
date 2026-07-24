"""
Reconciliación de vencimientos (Fase 2).

Recorre las acreditaciones APROBADAS cuya entrega vigente ya venció y aplica la
decisión de producto A:
  - si el contratista ya subió una entrega POSTERIOR con vigencia futura, se
    re-ancla la acreditación a esa entrega y queda ENVIADO (pendiente de la
    revisión del mandante) — evento RENOVACION_AUTO. Así un contratista que
    renovó a tiempo no cae en limbo por falta de un clic del mandante.
  - si no hay sucesora vigente, se marca VENCIDO — evento VENCIMIENTO.

Ignora los requisitos marcados sin_vencimiento. Función pura sobre la BD; la
dispara el cron (Celery beat) y también es llamable a mano. No envía emails —
eso lo orquesta el cron con el resultado.
"""
from datetime import date, datetime, timezone

from sqlalchemy.orm import Session

from app.domain.estados import EstadoDocumento, TipoEvento, validar_transicion
from app.models.expediente import Acreditacion, AcreditacionEvento, Entrega, Expediente
from app.models.pilar import RequisitoDocumental


def procesar_vencimientos(db: Session, hoy: date | None = None) -> dict[str, int]:
    """Reconcilia vencimientos. Devuelve {'renovadas': n, 'vencidas': m}."""
    hoy = hoy or date.today()

    candidatas = (
        db.query(Acreditacion)
        .join(Entrega, Acreditacion.entrega_id == Entrega.id)
        .join(Expediente, Acreditacion.expediente_id == Expediente.id)
        .join(RequisitoDocumental, Expediente.requisito_id == RequisitoDocumental.id)
        .filter(
            Acreditacion.estado == EstadoDocumento.APROBADO,
            Acreditacion.eliminado_en.is_(None),
            RequisitoDocumental.sin_vencimiento.is_(False),
            Entrega.fecha_vigencia_hasta.isnot(None),
            Entrega.fecha_vigencia_hasta < hoy,
        )
        .all()
    )

    renovadas = vencidas = 0
    afectadas: set[tuple] = set()
    for acred in candidatas:
        sucesora = _sucesora_vigente(acred, hoy)
        if sucesora is not None:
            _repin(db, acred, sucesora)
            renovadas += 1
        else:
            _vencer(db, acred)
            vencidas += 1
        par = _relacion_de(db, acred)
        if par:
            afectadas.add(par)

    db.commit()

    # Recalcular el agregado de cada relación afectada, una sola vez.
    from app.domain import acreditacion_service
    for contratista_id, mandante_id in afectadas:
        acreditacion_service.recalcular_estado_global(db, contratista_id, mandante_id)

    return {"renovadas": renovadas, "vencidas": vencidas}


def _sucesora_vigente(acred: Acreditacion, hoy: date) -> Entrega | None:
    """Última entrega del expediente posterior a la vigente, con vigencia futura (o sin fecha)."""
    vigente = acred.entrega
    sucesora = None
    for e in acred.expediente.entregas:  # ordenadas por numero_version
        if e.numero_version > vigente.numero_version and (
            e.fecha_vigencia_hasta is None or e.fecha_vigencia_hasta >= hoy
        ):
            sucesora = e
    return sucesora


def _repin(db: Session, acred: Acreditacion, sucesora: Entrega) -> None:
    validar_transicion(acred.estado, EstadoDocumento.ENVIADO)
    detalle = {"de_version": acred.numero_version, "a_version": sucesora.numero_version}
    acred.entrega_id = sucesora.id
    acred.numero_version = sucesora.numero_version
    acred.estado = EstadoDocumento.ENVIADO
    acred.mensaje_brecha = None
    db.add(AcreditacionEvento(
        acreditacion_id=acred.id, tipo_evento=TipoEvento.RENOVACION_AUTO,
        estado_anterior=EstadoDocumento.APROBADO, estado_nuevo=EstadoDocumento.ENVIADO,
        actor_usuario_id=None, detalle=detalle,
    ))


def _vencer(db: Session, acred: Acreditacion) -> None:
    validar_transicion(acred.estado, EstadoDocumento.VENCIDO)
    acred.estado = EstadoDocumento.VENCIDO
    db.add(AcreditacionEvento(
        acreditacion_id=acred.id, tipo_evento=TipoEvento.VENCIMIENTO,
        estado_anterior=EstadoDocumento.APROBADO, estado_nuevo=EstadoDocumento.VENCIDO,
        actor_usuario_id=None, detalle=None,
    ))


def _relacion_de(db: Session, acred: Acreditacion) -> tuple | None:
    exp = acred.expediente
    contratista_id = exp.empresa_id or (exp.trabajador.empresa_id if exp.trabajador_id else None)
    return (contratista_id, acred.mandante_id) if contratista_id else None
