"""
La empresa contratista se ve y se edita a sí misma.

Hasta ahora la ficha de fiscalización —mutualidad, dirección, teléfono de
emergencia y representante legal— solo se podía tocar desde el portal del
mandante (PATCH /mandantes/{id}/contratistas/{id}). El tester lo dijo con todas
sus letras: "al ingresar a la aplicación como contratista no solicita los datos
ni da alguna opción para registrarlos".

Y es la empresa la dueña natural de esos datos: quien conoce a su representante
legal y a qué mutualidad está afiliada es ella, no el mandante que la contrató.
Estos dos endpoints existen para que pueda completarlos por su cuenta.

Ambos operan SIEMPRE sobre la empresa del token (usuario.contratista_id): nunca
reciben un id de empresa por la URL, así que no hay id ajeno que falsear. La
misma validación de negocio la aplica contratista_service, que ya la usaba la
invitación y la edición del mandante — mutualidad de la lista cerrada y RUT del
representante con dígito verificador correcto.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.schemas import ActualizarEmpresaContratistaRequest, EmpresaContratistaResponse
from app.core.exceptions import AsignacionInvalida, RutInvalido
from app.domain import contratista_service
from app.infrastructure.database import get_db
from app.middleware.auth import require_rol
from app.models.contratista import EmpresaContratista
from app.models.usuario import Usuario

router = APIRouter()

# Quién administra la ficha de la empresa. El prevencionista sube documentos y ve
# brechas, pero los datos de fiscalización los mantiene quien administra la
# cuenta del contratista, igual que el mandante_admin del otro lado.
ROLES_CONTRATISTA = ["contratista_admin"]


def _mi_empresa(db: Session, usuario: Usuario) -> EmpresaContratista:
    if not usuario.contratista_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tu cuenta no está asociada a una empresa contratista.",
        )
    empresa = db.get(EmpresaContratista, usuario.contratista_id)
    if not empresa:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Empresa no encontrada.")
    return empresa


@router.get("/mi-empresa", response_model=EmpresaContratistaResponse)
def obtener_mi_empresa(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_rol(["contratista_admin", "prevencionista"])),
):
    """
    La ficha de la propia empresa. La lee también el prevencionista —para eso no
    hace falta administrar—; editarla sí exige contratista_admin.
    """
    return _mi_empresa(db, usuario)


@router.patch("/mi-empresa", response_model=EmpresaContratistaResponse)
def actualizar_mi_empresa(
    body: ActualizarEmpresaContratistaRequest,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_rol(ROLES_CONTRATISTA)),
):
    """
    Completa o corrige la ficha de fiscalización de la propia empresa.

    Edición parcial: solo viajan los campos que cambian, y la cadena vacía limpia
    —es la única forma de borrar un dato mal cargado, y todos son opcionales—.
    El RUT de la empresa no se toca: es la identidad con la que existe frente a
    todos sus mandantes (ver contratista_service.actualizar_empresa).
    """
    empresa = _mi_empresa(db, usuario)
    try:
        return contratista_service.actualizar_empresa(
            db, empresa.id, **body.model_dump(exclude_unset=True)
        )
    except (AsignacionInvalida, RutInvalido) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
