"""
Catálogo de pilares y requisitos documentales.
Lectura para cualquier rol autenticado; escritura del catálogo global
(mandante_id NULL) solo berisa_admin. Un mandante_admin puede crear,
editar y eliminar requisitos PROPIOS (mandante_id = su mandante),
visibles solo para su organización -- nunca para otros mandantes.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.api.schemas import ActualizarRequisitoCatalogoRequest, CrearRequisitoCatalogoRequest
from app.domain.estados import Alcance, EntidadTipo
from app.infrastructure.database import get_db
from app.middleware.auth import require_rol
from app.models.documento import Documento
from app.models.pilar import Pilar, Subpilar, RequisitoDocumental
from app.models.servicio import PerfilRequisitoConfig
from app.models.usuario import Usuario

router = APIRouter()

COLOR_MAP = {"LEGAL": "blue", "HSE": "amber", "COMPLIANCE": "purple"}


@router.get("/")
def listar_pilares(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_rol(["berisa_admin", "mandante_admin", "contratista_admin", "prevencionista"])),
):
    """
    Catálogo: pilares → subpilares → requisitos documentales.
    Incluye el catálogo global más, si el usuario pertenece a un
    mandante, los requisitos propios de ESE mandante únicamente.
    """
    pilares = (
        db.query(Pilar)
        .options(
            joinedload(Pilar.subpilares).joinedload(Subpilar.requisitos)
        )
        .order_by(Pilar.orden)
        .all()
    )

    resultado = []
    for p in pilares:
        subpilares = []
        for sp in sorted(p.subpilares, key=lambda x: x.orden):
            visibles = [
                r for r in sp.requisitos
                if r.mandante_id is None or r.mandante_id == usuario.mandante_id
            ]
            requisitos = [
                {
                    "id": str(r.id),
                    "codigo": r.codigo,
                    "nombre": r.nombre,
                    "descripcion": r.descripcion or "",
                    "entidad_tipo": r.entidad_tipo,
                    "alcance": r.alcance,
                    "max_archivos": r.max_archivos,
                    "es_propio": r.mandante_id is not None,
                }
                for r in visibles
            ]
            subpilares.append({
                "id": str(sp.id),
                "codigo": sp.codigo,
                "nombre": sp.nombre,
                "requisitos": requisitos,
            })
        resultado.append({
            "id": str(p.id),
            "codigo": p.codigo,
            "nombre": p.nombre,
            "orden": p.orden,
            "color": COLOR_MAP.get(p.codigo, "slate"),
            "subpilares": subpilares,
        })
    return resultado


@router.post("/{pilar_id}/requisitos", status_code=status.HTTP_201_CREATED)
def crear_requisito(
    pilar_id: uuid.UUID,
    body: CrearRequisitoCatalogoRequest,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_rol(["berisa_admin", "mandante_admin"])),
):
    """
    Agrega un requisito, dentro del primer subpilar del pilar.
    berisa_admin lo agrega al catálogo global; mandante_admin crea un
    requisito propio (mandante_id fijado desde el token, nunca desde
    el body) visible solo para su organización.
    """
    pilar = db.get(Pilar, pilar_id)
    if not pilar or not pilar.subpilares:
        raise HTTPException(status_code=404, detail="Pilar no encontrado o sin subpilares")

    mandante_id = usuario.mandante_id if usuario.rol == "mandante_admin" else None
    codigo_norm = body.codigo.strip().upper()
    duplicado = db.query(RequisitoDocumental).filter_by(codigo=codigo_norm, mandante_id=mandante_id).first()
    if duplicado:
        ambito = "tu organización" if mandante_id else "el catálogo global"
        raise HTTPException(status_code=400, detail=f"Ya existe un requisito con código {body.codigo} en {ambito}")
    # Un requisito propio NO puede colisionar con el catálogo global: las reglas
    # se resuelven por código en varios puntos y un código duplicado (propio vs
    # global) sería ambiguo. Ver docs/rediseno-modelo-documentos.md (Fase 0).
    if mandante_id is not None:
        global_existente = db.query(RequisitoDocumental).filter_by(codigo=codigo_norm, mandante_id=None).first()
        if global_existente:
            raise HTTPException(
                status_code=400,
                detail=f"El código {codigo_norm} ya existe en el catálogo global de BERISA. "
                       "Usa un código distinto para tu requisito propio.",
            )
    if body.entidad_tipo not in (EntidadTipo.EMPRESA, EntidadTipo.TRABAJADOR):
        raise HTTPException(status_code=400, detail="entidad_tipo debe ser EMPRESA o TRABAJADOR")
    if body.alcance not in (Alcance.ENTIDAD, Alcance.SERVICIO):
        raise HTTPException(status_code=400, detail="alcance debe ser ENTIDAD o SERVICIO")

    subpilar = sorted(pilar.subpilares, key=lambda x: x.orden)[0]
    req = RequisitoDocumental(
        subpilar_id=subpilar.id,
        mandante_id=mandante_id,
        codigo=codigo_norm,
        nombre=body.nombre,
        descripcion=body.descripcion,
        entidad_tipo=body.entidad_tipo,
        alcance=body.alcance,
        max_archivos=body.max_archivos,
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    mensaje = "Requisito propio creado" if mandante_id else "Requisito agregado al catálogo"
    return {"id": str(req.id), "mensaje": mensaje}


@router.patch("/requisitos/{requisito_id}")
def actualizar_requisito(
    requisito_id: uuid.UUID,
    body: ActualizarRequisitoCatalogoRequest,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_rol(["berisa_admin", "mandante_admin"])),
):
    """Actualiza nombre, descripción, alcance o límite de archivos de un requisito."""
    req = db.get(RequisitoDocumental, requisito_id)
    if not req:
        raise HTTPException(status_code=404, detail="Requisito no encontrado")
    if usuario.rol == "mandante_admin" and req.mandante_id != usuario.mandante_id:
        raise HTTPException(status_code=403, detail="Solo puede editar requisitos propios de su organización")

    if body.nombre is not None:
        req.nombre = body.nombre
    if body.descripcion is not None:
        req.descripcion = body.descripcion
    if body.alcance is not None:
        if body.alcance not in (Alcance.ENTIDAD, Alcance.SERVICIO):
            raise HTTPException(status_code=400, detail="alcance debe ser ENTIDAD o SERVICIO")
        req.alcance = body.alcance
    if body.max_archivos is not None:
        if body.max_archivos < 1:
            raise HTTPException(status_code=400, detail="max_archivos debe ser al menos 1")
        req.max_archivos = body.max_archivos
    db.commit()
    return {"mensaje": "Requisito actualizado"}


@router.delete("/requisitos/{requisito_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_requisito(
    requisito_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_rol(["berisa_admin", "mandante_admin"])),
):
    """
    Elimina un requisito SOLO si ningún perfil lo exige y no tiene
    expedientes — el catálogo con historia es evidencia, no se borra.
    mandante_admin solo puede eliminar requisitos propios de su organización.
    """
    req = db.get(RequisitoDocumental, requisito_id)
    if not req:
        raise HTTPException(status_code=404, detail="Requisito no encontrado")
    if usuario.rol == "mandante_admin" and req.mandante_id != usuario.mandante_id:
        raise HTTPException(status_code=403, detail="Solo puede eliminar requisitos propios de su organización")

    en_perfiles = db.query(PerfilRequisitoConfig).filter_by(requisito_documental_id=requisito_id).count()
    con_documentos = db.query(Documento).filter_by(requisito_id=requisito_id).count()
    if en_perfiles or con_documentos:
        raise HTTPException(
            status_code=409,
            detail=(
                f"No se puede eliminar: {en_perfiles} perfil(es) lo exigen y "
                f"{con_documentos} expediente(s) lo referencian."
            ),
        )
    db.delete(req)
    db.commit()
