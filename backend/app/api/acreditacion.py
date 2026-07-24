import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.schemas import AcreditacionResponse, RequisitoAvanceResponse
from app.domain import acreditacion_service
from app.infrastructure.database import get_db
from app.middleware.auth import require_rol
from app.middleware.tenant import verificar_acceso_relacion

router = APIRouter()


@router.get("/{contratista_id}/mandante/{mandante_id}/exigencias", response_model=list[RequisitoAvanceResponse])
def listar_exigencias(
    contratista_id: uuid.UUID,
    mandante_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario=Depends(require_rol(["berisa_admin", "mandante_admin", "contratista_admin", "prevencionista"])),
):
    """
    Todo lo que los servicios activos exigen a esta empresa, con el estado
    de cada expediente: items de empresa y de cada trabajador asignado,
    separados por servicio cuando el requisito es de alcance SERVICIO.
    Es la fuente de la página "Documentos" del contratista.
    """
    verificar_acceso_relacion(db, contratista_id, mandante_id, usuario)
    evaluacion = acreditacion_service.evaluar_relacion(db, contratista_id, mandante_id)
    items = list(evaluacion.items_empresa)
    for items_t in evaluacion.items_trabajadores.values():
        items.extend(items_t)
    return items


@router.get("/{contratista_id}/mandante/{mandante_id}", response_model=AcreditacionResponse)
def obtener_estado_acreditacion(
    contratista_id: uuid.UUID,
    mandante_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario=Depends(require_rol(["berisa_admin", "mandante_admin", "contratista_admin", "prevencionista"])),
):
    """
    Retorna el estado granular de acreditación de una empresa ante un mandante:
    pilares corporativos (1 y 3) + estado individual de cada trabajador (pilar 2).
    """
    verificar_acceso_relacion(db, contratista_id, mandante_id, usuario)
    resultado = acreditacion_service.obtener_estado_acreditacion(db, contratista_id, mandante_id)
    return AcreditacionResponse(
        contratista_id=resultado.contratista_id,
        mandante_id=resultado.mandante_id,
        estado_global=resultado.estado_global,
        pilares_empresa=[
            {"pilar_codigo": p.pilar_codigo, "pilar_nombre": p.pilar_nombre, "cumple": p.cumple, "brechas": p.brechas}
            for p in resultado.pilares_empresa
        ],
        trabajadores=[
            {
                "trabajador_id": t.trabajador_id,
                "nombre": t.nombre,
                "rut": t.rut,
                "cumple": t.cumple,
                "pilares": [
                    {"pilar_codigo": p.pilar_codigo, "pilar_nombre": p.pilar_nombre, "cumple": p.cumple, "brechas": p.brechas}
                    for p in t.pilares
                ],
            }
            for t in resultado.trabajadores
        ],
    )
