"""
Router de servicios: contratos/faenas entre mandante y contratista.
Solo HTTP — toda la lógica vive en domain/servicio_service.py.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.schemas import (
    ActualizarServicioRequest,
    AsignarTrabajadorServicioRequest,
    AvanceServicioResponse,
    CambiarEstadoServicioRequest,
    CrearServicioRequest,
    DefinirCargoAsignacionRequest,
    ServicioListItemResponse,
    ServicioResponse,
    TrabajadorAsignadoResponse,
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
from app.models.cargo import Cargo
from app.models.servicio import ServicioTrabajador
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


def _validar_acceso_al_servicio(servicio, usuario: Usuario) -> None:
    """
    El servicio pertenece a quien lo consulta, sea del lado que sea.

    Reemplaza al par de guardas sueltas que había: existía una para el
    contratista y la del mandante se escribía a mano en cada endpoint, así que
    donde alguien la olvidaba —GET /{sid}/trabajadores, PATCH /{sid},
    /cargos-disponibles y el PATCH de cargo— un mandante ajeno leía la nómina
    con RUT y nombre de una faena que no era suya, o la modificaba.

    berisa_admin pasa siempre: opera la plataforma. Se reconoce por el rol, no
    por tener los dos ids en NULL.
    """
    if usuario.rol == "berisa_admin":
        return
    if usuario.contratista_id:
        _validar_servicio_del_contratista(servicio, usuario)
        return
    if usuario.mandante_id:
        if servicio.relacion.mandante_id != usuario.mandante_id:
            raise HTTPException(status_code=403, detail="El servicio no pertenece a su mandante")
        return
    # Sin contratista_id ni mandante_id no hay tenant que verificar: negar es lo
    # único seguro. Es el caso del usuario mal creado que sería superadmin.
    raise HTTPException(status_code=403, detail="Tu cuenta no está asociada a una organización")


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
            centro_trabajo_id=body.centro_trabajo_id,
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
            mandante_id=s.relacion.mandante_id,
            mandante_razon_social=s.relacion.mandante.razon_social,
            perfil_nombre=s.perfil.nombre,
            trabajadores_asignados=sum(1 for a in s.trabajadores_asignados if a.activo),
            centro_trabajo_id=s.centro_trabajo_id,
            centro_trabajo_nombre=s.centro_trabajo.nombre if s.centro_trabajo else None,
            centro_trabajo_direccion=s.centro_trabajo.direccion if s.centro_trabajo else None,
            # El encargado es un usuario del MANDANTE y este listado lo lee
            # también el contratista. Se expone a propósito: es el contacto de la
            # faena a la que ese contratista tiene que llegar. No se expone
            # ningún otro usuario del mandante por esta vía.
            centro_trabajo_encargado=(
                s.centro_trabajo.encargado.nombre
                if s.centro_trabajo and s.centro_trabajo.encargado else None
            ),
            centro_trabajo_encargado_email=(
                s.centro_trabajo.encargado.email
                if s.centro_trabajo and s.centro_trabajo.encargado else None
            ),
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
    _validar_acceso_al_servicio(servicio, usuario)
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
    _validar_acceso_al_servicio(servicio, usuario)
    return servicio


@router.patch("/{servicio_id}", response_model=ServicioResponse)
def actualizar_servicio(
    servicio_id: uuid.UUID,
    body: ActualizarServicioRequest,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_rol(["berisa_admin", "mandante_admin"])),
):
    """
    Edita los datos descriptivos de un servicio, y sobre todo su centro de
    trabajo: es lo que permite completar los servicios creados antes de que los
    centros existieran.
    """
    mandante_id = _resolver_mandante_id(usuario, None)
    try:
        return servicio_service.actualizar_servicio(
            db, servicio_id, mandante_id,
            centro_trabajo_id=body.centro_trabajo_id,
            nombre=body.nombre,
            codigo_referencia=body.codigo_referencia,
            descripcion=body.descripcion,
            fecha_termino=body.fecha_termino,
        )
    except ServicioNoEncontrado as e:
        raise HTTPException(status_code=404, detail=str(e))
    except AsignacionInvalida as e:
        # El servicio de otro mandante responde 403; el resto son datos malos.
        codigo = 403 if "organización" in str(e) else 400
        raise HTTPException(status_code=codigo, detail=str(e))


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


@router.get("/{servicio_id}/cargos-disponibles")
def cargos_disponibles(
    servicio_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_rol(
        ["berisa_admin", "mandante_admin", "contratista_admin", "prevencionista"]
    )),
):
    """
    Cargos que se pueden asignar a alguien EN ESTE SERVICIO.

    Existe porque la pregunta correcta no es "qué cargos ve este usuario" sino
    "qué cargos aplican en esta faena". El servicio es lo que ata a un contratista
    con un mandante concreto, y el catálogo de cargos es del mandante.

    Sin esto la cadena queda cortada: `GET /cargos/` filtra por
    `usuario.mandante_id`, que en un contratista es NULL a propósito —trabaja para
    varios mandantes, no pertenece a ninguno— así que el contratista veía cero
    cargos y no podía clasificar a su gente, dejando la matriz sin efecto.

    Devuelve el catálogo global más los del mandante de ESTE servicio, que es
    exactamente la misma regla que ya valida `definir_cargo_asignacion` al
    escribir. Antes lectura y escritura no coincidían.
    """
    try:
        servicio = servicio_service.obtener_servicio(db, servicio_id)
    except ServicioNoEncontrado as e:
        raise HTTPException(status_code=404, detail=str(e))
    _validar_acceso_al_servicio(servicio, usuario)

    mandante_id = servicio.relacion.mandante_id
    cargos = (
        db.query(Cargo)
        .filter(Cargo.activo.is_(True))
        .filter(or_(Cargo.mandante_id.is_(None), Cargo.mandante_id == mandante_id))
        .order_by(Cargo.area, Cargo.nombre)
        .all()
    )
    return [
        {"id": str(c.id), "codigo": c.codigo, "nombre": c.nombre, "area": c.area}
        for c in cargos
    ]


@router.get("/{servicio_id}/trabajadores", response_model=list[TrabajadorAsignadoResponse])
def listar_trabajadores(
    servicio_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_rol(["berisa_admin", "mandante_admin", "contratista_admin", "prevencionista"])),
):
    """
    Trabajadores con asignación activa en el servicio, con el cargo del catálogo
    con el que participan en ESTA faena.

    Viajan los dos cargos: `cargo` es el texto libre de la nómina y `cargo_nombre`
    el del catálogo, que es el que decide qué documentos se le exigen.
    """
    try:
        servicio = servicio_service.obtener_servicio(db, servicio_id)
    except ServicioNoEncontrado as e:
        raise HTTPException(status_code=404, detail=str(e))
    # Devuelve RUT y nombre completo de personas: sin esta guarda, cualquier
    # usuario autenticado leía la dotación de una faena que no es suya.
    _validar_acceso_al_servicio(servicio, usuario)
    asignaciones = servicio_service.listar_trabajadores_servicio(db, servicio_id)
    return [
        TrabajadorAsignadoResponse(
            id=a.trabajador.id,
            rut=a.trabajador.rut,
            nombre_completo=a.trabajador.nombre_completo,
            cargo=a.trabajador.cargo,
            activo=a.trabajador.activo,
            cargo_id=a.cargo_id,
            cargo_nombre=a.cargo.nombre if a.cargo_id and a.cargo else None,
        )
        for a in asignaciones
    ]


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


@router.patch("/{servicio_id}/trabajadores/{trabajador_id}/cargo")
def definir_cargo_asignacion(
    servicio_id: uuid.UUID,
    trabajador_id: uuid.UUID,
    body: DefinirCargoAsignacionRequest,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_rol(["contratista_admin", "mandante_admin", "berisa_admin"])),
):
    """
    Con qué cargo participa esta persona en ESTA faena.

    Va en la asignación y no en el trabajador porque la misma persona puede ser
    operador en un servicio y administrativo en otro, con exigencias distintas.

    cargo_id=null lo deja sin declarar. Ojo con lo que eso significa: no exime de
    nada. A quien no tiene cargo se le exige TODO, incluido lo restringido por
    cargo (ver acreditacion_service._aplica_a_cargo).
    """
    asignacion = db.query(ServicioTrabajador).filter_by(
        servicio_id=servicio_id, trabajador_id=trabajador_id, activo=True
    ).first()
    if not asignacion:
        raise HTTPException(status_code=404, detail="El trabajador no está asignado a este servicio")

    servicio = servicio_service.obtener_servicio(db, servicio_id)
    _validar_acceso_al_servicio(servicio, usuario)

    if body.cargo_id is not None:
        cargo = db.get(Cargo, body.cargo_id)
        if not cargo or not cargo.activo:
            raise HTTPException(status_code=404, detail="Cargo no encontrado o inactivo")
        # Un cargo propio de OTRO mandante no debe poder usarse acá.
        if cargo.mandante_id is not None:
            servicio = servicio_service.obtener_servicio(db, servicio_id)
            if cargo.mandante_id != servicio.relacion.mandante_id:
                raise HTTPException(
                    status_code=400,
                    detail="Ese cargo pertenece a otro mandante",
                )

    asignacion.cargo_id = body.cargo_id
    db.commit()
    return {"mensaje": "Cargo actualizado" if body.cargo_id else "Cargo quitado"}


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
