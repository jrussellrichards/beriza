"""
Lógica de negocio de servicios y perfiles de requisitos.

Un servicio es el contrato/faena concreto entre un mandante y una empresa
contratista. Cada servicio referencia un perfil de requisitos del mandante,
que define qué documentos se exigen y con qué parámetros.
"""
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
from app.models.servicio import PerfilRequisitos, PerfilRequisitoConfig, Servicio, ServicioTrabajador
from app.models.trabajador import Trabajador


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
    return config


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
) -> Servicio:
    """
    Crea un servicio para la relación contratista↔mandante.
    Valida que la relación exista y que el perfil pertenezca al mismo mandante.
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

    servicio = Servicio(
        contratista_mandante_id=relacion.id,
        perfil_requisitos_id=perfil_requisitos_id,
        nombre=nombre,
        codigo_referencia=codigo_referencia,
        descripcion=descripcion,
        fecha_inicio=fecha_inicio,
        fecha_termino=fecha_termino,
        estado=EstadoServicio.ACTIVO,
    )
    db.add(servicio)
    db.commit()
    db.refresh(servicio)
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
        )
    )
    if mandante_id:
        query = query.filter(ContratistaMandante.mandante_id == mandante_id)
    if contratista_id:
        query = query.filter(ContratistaMandante.contratista_id == contratista_id)
    return query.order_by(Servicio.created_at.desc()).all()


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
