import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.api.schemas import (
    AgregarTrabajadorRequest, ReporteImportacionResponse, TrabajadorHabilitacionResponse,
    TrabajadorResponse,
)
from app.domain import acreditacion_service, nomina_service
from app.infrastructure.database import get_db
from app.middleware.auth import require_rol
from app.models.trabajador import Trabajador
from app.models.usuario import Usuario

router = APIRouter()

# Tope de tamaño del archivo. Una nomina de 5000 filas pesa ~200 KB; 5 MB deja
# holgura de sobra y corta un envio equivocado antes de leerlo a memoria.
MAX_BYTES_NOMINA = 5 * 1024 * 1024


@router.get("/mis-trabajadores", response_model=list[TrabajadorHabilitacionResponse])
def mis_trabajadores(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_rol(["contratista_admin", "prevencionista"])),
):
    """
    La dotación del contratista con la habilitación de cada persona en cada
    servicio donde está asignada. Responde "¿puede entrar Pedro a esta faena?",
    que es la pregunta operativa del día a día y antes no se podía contestar.

    Es POR SERVICIO: dos servicios del mismo cliente pueden exigir cosas
    distintas, así que un trabajador puede estar habilitado en uno y no en otro.
    """
    if not usuario.contratista_id:
        raise HTTPException(status_code=400, detail="El usuario no está asociado a un contratista")
    return acreditacion_service.habilitacion_trabajadores(db, usuario.contratista_id)



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


@router.get("/plantilla-nomina")
def descargar_plantilla_nomina(
    usuario: Usuario = Depends(require_rol(["contratista_admin", "prevencionista"])),
):
    """Plantilla CSV para la carga masiva, con ejemplos válidos."""
    return Response(
        content=nomina_service.plantilla_csv(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="plantilla-nomina.csv"'},
    )


@router.post("/cargar-nomina", response_model=ReporteImportacionResponse)
async def cargar_nomina(
    archivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_rol(["contratista_admin", "prevencionista"])),
):
    """
    Carga masiva de trabajadores desde CSV o Excel.

    Responde 200 aunque haya filas con error: la importación es parcial a
    propósito (ver el docstring de nomina_service). El reporte dice qué pasó con
    cada fila; devolver un 4xx obligaría al frontend a tratar como fallo una
    carga que sí subió 77 de 80.
    """
    if not usuario.contratista_id:
        raise HTTPException(status_code=400, detail="El usuario no está asociado a una empresa")

    contenido = await archivo.read()
    if not contenido:
        raise HTTPException(status_code=400, detail="El archivo está vacío.")
    if len(contenido) > MAX_BYTES_NOMINA:
        raise HTTPException(
            status_code=400,
            detail=f"El archivo supera {MAX_BYTES_NOMINA // (1024 * 1024)} MB.",
        )

    try:
        reporte = nomina_service.importar_nomina(
            db, usuario.contratista_id, contenido, archivo.filename or "",
        )
    except ValueError as e:
        # Problemas del ARCHIVO (formato, columnas, vacío): no hay nada que
        # reportar por fila, así que sí corresponde un 400.
        raise HTTPException(status_code=400, detail=str(e))

    return ReporteImportacionResponse(
        filas_leidas=reporte.filas_leidas,
        cargados=reporte.cargados,
        ya_existian=reporte.ya_existian,
        con_error=reporte.con_error,
        errores=[
            {"fila": e.fila, "rut": e.rut, "nombre": e.nombre, "motivo": e.motivo}
            for e in reporte.errores
        ],
    )


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
