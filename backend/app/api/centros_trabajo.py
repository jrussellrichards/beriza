import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.schemas import CentroTrabajoRequest, CentroTrabajoResponse
from app.core.exceptions import PermisoInsuficiente
from app.domain import centro_trabajo_service as servicio
from app.domain.centro_trabajo_service import CentroTrabajoInvalido, CentroTrabajoNoEncontrado
from app.infrastructure.database import get_db
from app.middleware.auth import require_rol
from app.models.usuario import Usuario

router = APIRouter()


def _mandante_de(usuario: Usuario) -> uuid.UUID:
    """
    El mandante sale SIEMPRE del token, nunca del path ni del body: es lo que
    impide que alguien lea o cree centros de otra organización pasando un id.
    """
    if not usuario.mandante_id:
        raise HTTPException(status_code=400, detail="El usuario no está asociado a un mandante")
    return usuario.mandante_id


def _a_response(db: Session, centro) -> CentroTrabajoResponse:
    return CentroTrabajoResponse(
        id=centro.id,
        nombre=centro.nombre,
        direccion=centro.direccion,
        encargado_id=centro.encargado_id,
        encargado_nombre=centro.encargado.nombre if centro.encargado else None,
        activo=centro.activo,
        servicios_activos=servicio.servicios_activos(db, centro.id),
    )


@router.get("/", response_model=list[CentroTrabajoResponse])
def listar_centros(
    incluir_inactivos: bool = False,
    db: Session = Depends(get_db),
    # Los revisores también los ven: necesitan saber dónde ocurre lo que revisan.
    usuario: Usuario = Depends(require_rol(["berisa_admin", "mandante_admin", "prevencionista"])),
):
    """Centros de trabajo del mandante del usuario."""
    centros = servicio.listar(db, _mandante_de(usuario), incluir_inactivos=incluir_inactivos)
    return [_a_response(db, c) for c in centros]


@router.post("/", response_model=CentroTrabajoResponse, status_code=status.HTTP_201_CREATED)
def crear_centro(
    body: CentroTrabajoRequest,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_rol(["berisa_admin", "mandante_admin"])),
):
    """Crea un centro de trabajo: dónde se ejecutan los servicios."""
    try:
        centro = servicio.crear(
            db, _mandante_de(usuario),
            nombre=body.nombre, direccion=body.direccion, encargado_id=body.encargado_id,
        )
    except CentroTrabajoInvalido as e:
        raise HTTPException(status_code=400, detail=str(e))
    return _a_response(db, centro)


@router.put("/{centro_id}", response_model=CentroTrabajoResponse)
def actualizar_centro(
    centro_id: uuid.UUID,
    body: CentroTrabajoRequest,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_rol(["berisa_admin", "mandante_admin"])),
):
    try:
        centro = servicio.actualizar(
            db, centro_id, _mandante_de(usuario),
            nombre=body.nombre, direccion=body.direccion,
            encargado_id=body.encargado_id, limpiar_encargado=body.limpiar_encargado,
        )
    except CentroTrabajoNoEncontrado as e:
        raise HTTPException(status_code=404, detail=str(e))
    except CentroTrabajoInvalido as e:
        raise HTTPException(status_code=400, detail=str(e))
    return _a_response(db, centro)


@router.delete("/{centro_id}", response_model=CentroTrabajoResponse)
def cerrar_centro(
    centro_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_rol(["berisa_admin", "mandante_admin"])),
):
    """
    Cierra el centro (baja lógica). No se borra: los servicios históricos
    apuntan a él y eliminarlo dejaría la bitácora sin dónde ocurrieron las
    cosas, que es lo que se necesita en una fiscalización.
    """
    mandante_id = _mandante_de(usuario)
    try:
        activos = servicio.servicios_activos(db, servicio.obtener(db, centro_id, mandante_id).id)
        if activos:
            raise HTTPException(
                status_code=400,
                detail=f"El centro tiene {activos} servicio(s) activo(s). "
                       "Termínalos o muévelos antes de cerrarlo.",
            )
        centro = servicio.desactivar(db, centro_id, mandante_id)
    except CentroTrabajoNoEncontrado as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermisoInsuficiente as e:
        raise HTTPException(status_code=403, detail=str(e))
    return _a_response(db, centro)
