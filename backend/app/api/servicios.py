"""
Router de servicios: contratos/faenas entre mandante y contratista.
Solo HTTP — toda la lógica vive en domain/servicio_service.py.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.schemas import (
    AsignarTrabajadorServicioRequest,
    AvanceServicioResponse,
    CambiarEstadoServicioRequest,
    CrearServicioRequest,
    ServicioListItemResponse,
    ServicioResponse,
    TrabajadorResponse,
)
from app.core.exceptions import (
    AsignacionInvalida,
    ContratistaNoEncontrado,
    EstadoServicioInvalido,
    PerfilNoEncontrado,
    ServicioNoEncontrado,
    TrabajadorNoEncontrado,
)
from app.domain import acreditacion_service, servicio_service
from app.infrastructure.database import get_db
from app.middleware.auth import require_rol
from app.models.usuario import Usuario

router = APIRouter()


def _resolver_mandante_id(usuario: Usuario, mandante_id_body: uuid.UUID | None) -> uuid.UUID:
    """mandante_admin opera sobre su propio mandante; berisa_admin debe indicarlo."""
    if usuario.mandante_id:
        return usuario.mandante_id
    if mandante_id_body:
        return mandante_id_body
    raise HTTPException(status_code=400, detail="Debe indicar mandante_id")


def _validar_servicio_del_contratista(servicio, usuario: Usuario) -> None:
    """Un usuario contratista solo opera sobre servicios de su propia empresa."""
    if servicio.relacion.contratista_id != usuario.contratista_id:
        raise HTTPException(status_code=403, detail="El servicio no pertenece a su empresa")


@router.post("/", response_model=ServicioResponse, status_code=status.HTTP_201_CREATED)
def crear_servicio(
    body: CrearServicioRequest,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_rol(["berisa_admin", "mandante_admin"])),
):
    """Crea un servicio para un contratista con un perfil de requisitos del mandante."""
    mandante_id = _resolver_mandante_id(usuario, body.mandante_id)
    try:
        return servicio_service.crear_servicio(
            db,
            mandante_id=mandante_id,
            contratista_id=body.contratista_id,
            perfil_requisitos_id=body.perfil_requisitos_id,
            nombre=body.nombre,
            fecha_inicio=body.fecha_inicio,
            codigo_referencia=body.codigo_referencia,
            descripcion=body.descripcion,
            fecha_termino=body.fecha_termino,
        )
    except (ContratistaNoEncontrado, PerfilNoEncontrado) as e:
        raise HTTPException(status_code=404, detail=str(e))
    except AsignacionInvalida as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/", response_model=list[ServicioListItemResponse])
def listar_servicios(
    contratista_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_rol(["berisa_admin", "mandante_admin", "contratista_admin", "prevencionista"])),
):
    """
    Lista servicios según el tenant del usuario:
    mandante ve los suyos (opcionalmente filtrados por contratista),
    contratista ve solo los de su empresa.
    """
    if usuario.contratista_id:
        servicios = servicio_service.listar_servicios(db, contratista_id=usuario.contratista_id)
    else:
        servicios = servicio_service.listar_servicios(
            db, mandante_id=usuario.mandante_id, contratista_id=contratista_id
        )
    return [
        ServicioListItemResponse(
            id=s.id,
            nombre=s.nombre,
            codigo_referencia=s.codigo_referencia,
            estado=s.estado,
            fecha_inicio=s.fecha_inicio,
            fecha_termino=s.fecha_termino,
            contratista_id=s.relacion.contratista_id,
            contratista_razon_social=s.relacion.contratista.razon_social,
            contratista_rut=s.relacion.contratista.rut,
            perfil_nombre=s.perfil.nombre,
            trabajadores_asignados=sum(1 for a in s.trabajadores_asignados if a.activo),
        )
        for s in servicios
    ]


@router.get("/{servicio_id}/avance", response_model=AvanceServicioResponse)
def avance_servicio(
    servicio_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_rol(["berisa_admin", "mandante_admin", "contratista_admin", "prevencionista"])),
):
    """
    Estado de completitud del servicio: cuántos documentos exige el perfil,
    cuántos se han subido y en qué estado están, por pilar y por trabajador.
    Cálculo derivado — nunca se almacena.
    """
    try:
        servicio = servicio_service.obtener_servicio(db, servicio_id)
    except ServicioNoEncontrado as e:
        raise HTTPException(status_code=404, detail=str(e))
    if usuario.contratista_id:
        _validar_servicio_del_contratista(servicio, usuario)
    elif usuario.mandante_id and servicio.relacion.mandante_id != usuario.mandante_id:
        raise HTTPException(status_code=403, detail="El servicio no pertenece a su mandante")
    return acreditacion_service.obtener_avance_servicio(db, servicio_id)


@router.get("/{servicio_id}", response_model=ServicioResponse)
def obtener_servicio(
    servicio_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_rol(["berisa_admin", "mandante_admin", "contratista_admin", "prevencionista"])),
):
    try:
        servicio = servicio_service.obtener_servicio(db, servicio_id)
    except ServicioNoEncontrado as e:
        raise HTTPException(status_code=404, detail=str(e))
    if usuario.contratista_id:
        _validar_servicio_del_contratista(servicio, usuario)
    elif usuario.mandante_id and servicio.relacion.mandante_id != usuario.mandante_id:
        raise HTTPException(status_code=403, detail="El servicio no pertenece a su mandante")
    return servicio


@router.patch("/{servicio_id}/estado", response_model=ServicioResponse)
def cambiar_estado_servicio(
    servicio_id: uuid.UUID,
    body: CambiarEstadoServicioRequest,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_rol(["berisa_admin", "mandante_admin"])),
):
    try:
        servicio = servicio_service.obtener_servicio(db, servicio_id)
        if usuario.mandante_id and servicio.relacion.mandante_id != usuario.mandante_id:
            raise HTTPException(status_code=403, detail="El servicio no pertenece a su mandante")
        return servicio_service.cambiar_estado_servicio(db, servicio_id, body.estado)
    except ServicioNoEncontrado as e:
        raise HTTPException(status_code=404, detail=str(e))
    except EstadoServicioInvalido as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{servicio_id}/trabajadores", response_model=list[TrabajadorResponse])
def listar_trabajadores(
    servicio_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_rol(["berisa_admin", "mandante_admin", "contratista_admin", "prevencionista"])),
):
    """Trabajadores con asignación activa en el servicio."""
    try:
        asignaciones = servicio_service.listar_trabajadores_servicio(db, servicio_id)
    except ServicioNoEncontrado as e:
        raise HTTPException(status_code=404, detail=str(e))
    return [a.trabajador for a in asignaciones]


@router.post("/{servicio_id}/trabajadores", status_code=status.HTTP_201_CREATED)
def asignar_trabajador(
    servicio_id: uuid.UUID,
    body: AsignarTrabajadorServicioRequest,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_rol(["contratista_admin"])),
):
    """El contratista declara qué trabajadores participan en la faena."""
    try:
        servicio = servicio_service.obtener_servicio(db, servicio_id)
        _validar_servicio_del_contratista(servicio, usuario)
        servicio_service.asignar_trabajador(db, servicio_id, body.trabajador_id)
    except (ServicioNoEncontrado, TrabajadorNoEncontrado) as e:
        raise HTTPException(status_code=404, detail=str(e))
    except (AsignacionInvalida, EstadoServicioInvalido) as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"mensaje": "Trabajador asignado al servicio"}


@router.delete("/{servicio_id}/trabajadores/{trabajador_id}")
def desasignar_trabajador(
    servicio_id: uuid.UUID,
    trabajador_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_rol(["contratista_admin"])),
):
    """Desactiva la asignación conservando el historial (soft delete)."""
    try:
        servicio = servicio_service.obtener_servicio(db, servicio_id)
        _validar_servicio_del_contratista(servicio, usuario)
        servicio_service.desasignar_trabajador(db, servicio_id, trabajador_id)
    except (ServicioNoEncontrado, TrabajadorNoEncontrado) as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"mensaje": "Trabajador desasignado del servicio"}
