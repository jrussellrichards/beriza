import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.api.schemas import (
    ActualizarTrabajadorRequest, AgregarTrabajadorRequest, ReporteImportacionResponse,
    TrabajadorHabilitacionResponse,
    TrabajadorResponse,
)
from app.core.exceptions import AsignacionInvalida, RutInvalido
from app.domain import acreditacion_service, nomina_service, trabajador_service
from app.infrastructure.database import get_db
from app.middleware.auth import exigir_acceso_a_contratista, require_rol
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
    """
    Registra un nuevo trabajador en la empresa del usuario autenticado.

    Delega en trabajador_service para seguir las MISMAS reglas que la carga
    masiva. Antes construía el modelo acá y no validaba el RUT, así que la misma
    persona se aceptaba de a una y se rechazaba por nómina.
    """
    if not usuario.contratista_id:
        raise HTTPException(status_code=400, detail="El usuario no está asociado a una empresa")

    try:
        return trabajador_service.crear_trabajador(
            db, usuario.contratista_id, **body.model_dump()
        )
    except RutInvalido as e:
        raise HTTPException(status_code=400, detail=str(e))
    except AsignacionInvalida as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{trabajador_id}", response_model=TrabajadorResponse)
def actualizar_trabajador(
    trabajador_id: uuid.UUID,
    body: ActualizarTrabajadorRequest,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_rol(["contratista_admin", "prevencionista"])),
):
    """
    Completa o corrige la ficha de un trabajador de la propia empresa.

    Existe porque los datos personales son opcionales al darlo de alta y porque
    la carga masiva solo trae RUT, nombre y cargo: sin esto, todo el que entró
    por nómina se quedaría para siempre sin contacto de emergencia.
    """
    if not usuario.contratista_id:
        raise HTTPException(status_code=400, detail="El usuario no está asociado a una empresa")

    try:
        return trabajador_service.actualizar_trabajador(
            db, trabajador_id, usuario.contratista_id,
            **body.model_dump(exclude_unset=True),
        )
    except AsignacionInvalida as e:
        # "No pertenece a tu empresa" cubre tanto que no exista como que sea de
        # otra: distinguirlos le confirmaria a un curioso que el id existe.
        raise HTTPException(status_code=404 if "pertenece" in str(e) else 400, detail=str(e))


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
    # Devuelve RUT y nombre completo de una persona: sin esta guarda cualquier
    # usuario autenticado leía la ficha de cualquier trabajador de la plataforma.
    exigir_acceso_a_contratista(db, usuario, t.empresa_id)
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
    exigir_acceso_a_contratista(db, usuario, empresa_id)
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
