import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.schemas import AgregarTrabajadorRequest, TrabajadorResponse
from app.infrastructure.database import get_db
from app.middleware.auth import require_rol
from app.models.trabajador import Trabajador
from app.models.usuario import Usuario

router = APIRouter()


@router.post("/", response_model=TrabajadorResponse, status_code=status.HTTP_201_CREATED)
def agregar_trabajador(
    body: AgregarTrabajadorRequest,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_rol(["contratista_admin", "prevencionista"])),
):
    """Registra un nuevo trabajador en la empresa del usuario autenticado."""
    if not usuario.contratista_id:
        raise HTTPException(status_code=400, detail="El usuario no está asociado a una empresa")

    trabajador = Trabajador(
        empresa_id=usuario.contratista_id,
        rut=body.rut,
        nombre_completo=body.nombre_completo,
        cargo=body.cargo,
        activo=True,
    )
    db.add(trabajador)
    db.commit()
    db.refresh(trabajador)
    return trabajador


@router.get("/{trabajador_id}", response_model=TrabajadorResponse)
def obtener_trabajador(
    trabajador_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario=Depends(require_rol(["berisa_admin", "mandante_admin", "contratista_admin", "prevencionista"])),
):
    t = db.get(Trabajador, trabajador_id)
    if not t:
        raise HTTPException(status_code=404, detail="Trabajador no encontrado")
    return t


@router.get("/empresa/{empresa_id}", response_model=list[TrabajadorResponse])
def listar_trabajadores_empresa(
    empresa_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario=Depends(require_rol(["berisa_admin", "mandante_admin", "contratista_admin", "prevencionista"])),
):
    """
    Lista todos los trabajadores de una empresa (activos e inactivos --
    el frontend distingue con el campo activo; si aquí se filtraran los
    inactivos, un trabajador desactivado desaparecería sin forma de
    reactivarlo desde la UI).
    """
    return db.query(Trabajador).filter_by(empresa_id=empresa_id).all()


@router.patch("/{trabajador_id}/desactivar", status_code=status.HTTP_204_NO_CONTENT)
def desactivar_trabajador(
    trabajador_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_rol(["contratista_admin"])),
):
    """
    Desactiva un trabajador. Solo contratista_admin puede hacerlo.
    Los prevencionistas pueden agregar pero no desactivar.
    """
    t = db.get(Trabajador, trabajador_id)
    if not t:
        raise HTTPException(status_code=404, detail="Trabajador no encontrado")
    if t.empresa_id != usuario.contratista_id:
        raise HTTPException(status_code=403, detail="No tiene permiso sobre este trabajador")
    t.activo = False
    db.commit()


@router.patch("/{trabajador_id}/reactivar", status_code=status.HTTP_204_NO_CONTENT)
def reactivar_trabajador(
    trabajador_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_rol(["contratista_admin"])),
):
    """Reactiva un trabajador previamente desactivado. Solo contratista_admin."""
    t = db.get(Trabajador, trabajador_id)
    if not t:
        raise HTTPException(status_code=404, detail="Trabajador no encontrado")
    if t.empresa_id != usuario.contratista_id:
        raise HTTPException(status_code=403, detail="No tiene permiso sobre este trabajador")
    t.activo = True
    db.commit()
