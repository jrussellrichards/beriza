import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api.schemas import DocumentoResponse, SubidaDocumentoResponse, UrlDescargaResponse
from app.core.exceptions import DocumentoNoEncontrado, EstadoDocumentoInvalido
from app.domain import documento_service
from app.infrastructure.database import get_db
from app.infrastructure.storage import get_storage
from app.middleware.auth import require_rol
from app.models.pilar import Pilar, Subpilar, RequisitoDocumental
from app.models.documento import Documento
from app.models.trabajador import Trabajador
from app.models.usuario import Usuario

router = APIRouter()

COLOR_PILAR = {"LEGAL": "blue", "HSE": "amber", "COMPLIANCE": "purple"}

MIME_PERMITIDOS = {"application/pdf"}
TAMAÑO_MAX_BYTES = 20 * 1024 * 1024  # 20 MB


@router.post("/", response_model=SubidaDocumentoResponse, status_code=status.HTTP_202_ACCEPTED)
async def subir_documento(
    requisito_id: uuid.UUID = Form(...),
    mandante_id: uuid.UUID = Form(...),
    empresa_id: uuid.UUID | None = Form(None),
    trabajador_id: uuid.UUID | None = Form(None),
    archivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_rol(["contratista_admin", "prevencionista"])),
):
    """
    Recibe un PDF, lo guarda en storage y encola el análisis IA.
    Responde inmediatamente con documento_id y estado=1 (Enviado).
    """
    if archivo.content_type not in MIME_PERMITIDOS:
        raise HTTPException(status_code=400, detail="Solo se aceptan archivos PDF")

    contenido = await archivo.read()
    if len(contenido) > TAMAÑO_MAX_BYTES:
        raise HTTPException(status_code=400, detail="El archivo supera el límite de 20 MB")

    if empresa_id is None and trabajador_id is None:
        raise HTTPException(status_code=400, detail="Debe indicar empresa_id o trabajador_id")

    storage = get_storage()
    carpeta = f"mandante_{mandante_id}"
    subido = storage.subir(contenido, archivo.filename or "documento.pdf", carpeta)

    resultado = documento_service.subir_documento(
        db=db,
        requisito_id=requisito_id,
        mandante_id=mandante_id,
        empresa_id=empresa_id,
        trabajador_id=trabajador_id,
        archivo_url=subido.url,
    )

    return SubidaDocumentoResponse(
        documento_id=resultado.documento_id,
        mensaje=resultado.mensaje,
    )


@router.get("/{documento_id}", response_model=DocumentoResponse)
def obtener_documento(
    documento_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario=Depends(require_rol(["berisa_admin", "mandante_admin", "contratista_admin", "prevencionista"])),
):
    """Retorna el estado actual y resultado del análisis de un documento."""
    try:
        return documento_service.obtener_documento(db, documento_id)
    except DocumentoNoEncontrado:
        raise HTTPException(status_code=404, detail="Documento no encontrado")


@router.post("/{documento_id}/aprobar-excepcion", status_code=status.HTTP_204_NO_CONTENT)
def aprobar_por_excepcion(
    documento_id: uuid.UUID,
    justificacion: str = Form(...),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_rol(["mandante_admin"])),
):
    """
    Aprueba manualmente un documento observado. Solo mandante_admin.
    Registra quién aprobó, cuándo y con qué justificación.
    """
    try:
        documento_service.aprobar_por_excepcion(db, documento_id, usuario.id, justificacion)
    except DocumentoNoEncontrado:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    except EstadoDocumentoInvalido as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/empresa/{empresa_id}/mandante/{mandante_id}/agrupados")
def documentos_agrupados(
    empresa_id: uuid.UUID,
    mandante_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario=Depends(require_rol(["berisa_admin", "mandante_admin", "contratista_admin", "prevencionista"])),
):
    """
    Documentos de una empresa ante un mandante, agrupados por pilar.
    Incluye docs de empresa y docs por trabajador en subsecciones.
    """
    pilares = db.query(Pilar).order_by(Pilar.orden).all()

    # Último doc por requisito para la empresa
    docs_empresa = {}
    for d in (
        db.query(Documento)
        .filter_by(empresa_id=empresa_id, mandante_id=mandante_id)
        .order_by(Documento.created_at.desc())
        .all()
    ):
        key = str(d.requisito_id)
        if key not in docs_empresa:
            docs_empresa[key] = d

    # Último doc por (trabajador_id, requisito_id)
    docs_trabajadores: dict[str, dict[str, Documento]] = {}
    for d in (
        db.query(Documento)
        .filter_by(mandante_id=mandante_id)
        .filter(Documento.trabajador_id.isnot(None))
        .join(Trabajador, Documento.trabajador_id == Trabajador.id)
        .filter(Trabajador.empresa_id == empresa_id)
        .order_by(Documento.created_at.desc())
        .all()
    ):
        tid = str(d.trabajador_id)
        rid = str(d.requisito_id)
        if tid not in docs_trabajadores:
            docs_trabajadores[tid] = {}
        if rid not in docs_trabajadores[tid]:
            docs_trabajadores[tid][rid] = d

    # Trabajadores activos
    trabajadores = db.query(Trabajador).filter_by(empresa_id=empresa_id, activo=True).all()

    resultado = []
    for pilar in pilares:
        req_empresa = []
        req_trabajador = []
        for sp in pilar.subpilares:
            for req in sp.requisitos:
                if req.entidad_tipo == "EMPRESA":
                    req_empresa.append(req)
                else:
                    req_trabajador.append(req)

        docs_empresa_pilar = []
        for req in req_empresa:
            doc = docs_empresa.get(str(req.id))
            docs_empresa_pilar.append({
                "id": str(doc.id) if doc else None,
                "requisito_id": str(req.id),
                "requisito_codigo": req.codigo,
                "requisito_nombre": req.nombre,
                "estado": doc.estado if doc else None,
                "fecha_vigencia_hasta": doc.fecha_vigencia_hasta.isoformat() if doc and doc.fecha_vigencia_hasta else None,
                "mensaje_brecha": doc.mensaje_brecha if doc else None,
            })

        docs_trabajadores_pilar = []
        if req_trabajador:
            for t in trabajadores:
                tid = str(t.id)
                t_docs = []
                for req in req_trabajador:
                    doc = docs_trabajadores.get(tid, {}).get(str(req.id))
                    t_docs.append({
                        "id": str(doc.id) if doc else None,
                        "requisito_id": str(req.id),
                        "requisito_codigo": req.codigo,
                        "requisito_nombre": req.nombre,
                        "estado": doc.estado if doc else None,
                        "fecha_vigencia_hasta": doc.fecha_vigencia_hasta.isoformat() if doc and doc.fecha_vigencia_hasta else None,
                        "mensaje_brecha": doc.mensaje_brecha if doc else None,
                    })
                docs_trabajadores_pilar.append({
                    "trabajador_id": tid,
                    "trabajador_nombre": t.nombre_completo,
                    "trabajador_rut": t.rut,
                    "documentos": t_docs,
                })

        resultado.append({
            "pilar_codigo": pilar.codigo,
            "pilar_nombre": pilar.nombre,
            "color": COLOR_PILAR.get(pilar.codigo, "slate"),
            "documentos_empresa": docs_empresa_pilar,
            "documentos_trabajadores": docs_trabajadores_pilar,
        })

    return resultado


@router.get("/{documento_id}/url-descarga", response_model=UrlDescargaResponse)
def obtener_url_descarga(
    documento_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario=Depends(require_rol(["berisa_admin", "mandante_admin", "contratista_admin", "prevencionista"])),
):
    """
    Retorna una URL firmada temporal (1 hora) para descargar el PDF.
    Nunca expone la URL interna de storage directamente.
    """
    try:
        doc = documento_service.obtener_documento(db, documento_id)
    except DocumentoNoEncontrado:
        raise HTTPException(status_code=404, detail="Documento no encontrado")

    storage = get_storage()
    url_firmada = storage.obtener_url_firmada(doc.archivo_url, expira_en_segundos=3600)

    return UrlDescargaResponse(url=url_firmada)
