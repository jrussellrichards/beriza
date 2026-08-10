"""
Catálogo de cargos.

Lectura para cualquier rol autenticado (el contratista necesita verlos para
asignar a su gente). Escritura del catálogo global (mandante_id NULL) solo
berisa_admin; un mandante_admin crea cargos PROPIOS de su organización.

Mismo modelo de propiedad que RequisitoDocumental, y por la misma razón: el
catálogo que BERISA envía con el producto tiene que ser defendible ante
cualquier cliente, y lo que un mandante inventa para sí no debe filtrarse a los
demás.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.schemas import ActualizarCargoRequest, CrearCargoRequest
from app.infrastructure.database import get_db
from app.middleware.auth import require_rol
from app.models.cargo import Cargo
from app.models.servicio import PerfilRequisitoCargo, ServicioTrabajador
from app.models.usuario import Usuario

router = APIRouter()


@router.get("/")
def listar_cargos(
    incluir_inactivos: bool = False,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_rol(
        ["berisa_admin", "mandante_admin", "contratista_admin", "prevencionista"]
    )),
):
    """
    Catálogo global más, si el usuario pertenece a un mandante, los cargos
    propios de ESE mandante.

    El contratista_admin ve el global y los del mandante de su token, que es lo
    que necesita para clasificar a su gente en la faena de ese mandante.
    """
    q = db.query(Cargo)
    if not incluir_inactivos:
        q = q.filter(Cargo.activo.is_(True))
    cargos = [
        c for c in q.order_by(Cargo.area, Cargo.nombre).all()
        if c.mandante_id is None or c.mandante_id == usuario.mandante_id
    ]
    return [
        {
            "id": str(c.id),
            "codigo": c.codigo,
            "nombre": c.nombre,
            "area": c.area,
            "activo": c.activo,
            "es_propio": c.mandante_id is not None,
        }
        for c in cargos
    ]


@router.post("/", status_code=status.HTTP_201_CREATED)
def crear_cargo(
    body: CrearCargoRequest,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_rol(["berisa_admin", "mandante_admin"])),
):
    """berisa_admin crea en el catálogo global; mandante_admin crea uno propio."""
    mandante_id = usuario.mandante_id if usuario.rol == "mandante_admin" else None
    codigo = body.codigo.strip().upper()
    if not codigo:
        raise HTTPException(status_code=400, detail="El código no puede ir vacío")

    if db.query(Cargo).filter_by(codigo=codigo, mandante_id=mandante_id).first():
        ambito = "tu organización" if mandante_id else "el catálogo global"
        raise HTTPException(status_code=400, detail=f"Ya existe el cargo {codigo} en {ambito}")
    # Un cargo propio no puede pisar un código global: al resolver por código
    # quedaría ambiguo cuál de los dos manda. Mismo criterio que en requisitos.
    if mandante_id is not None and db.query(Cargo).filter_by(codigo=codigo, mandante_id=None).first():
        raise HTTPException(
            status_code=400,
            detail=f"El código {codigo} ya existe en el catálogo global de BERISA. Usa otro.",
        )

    cargo = Cargo(
        mandante_id=mandante_id,
        codigo=codigo,
        nombre=body.nombre.strip(),
        area=(body.area or "").strip().upper() or None,
    )
    db.add(cargo)
    db.commit()
    db.refresh(cargo)
    return {"id": str(cargo.id), "mensaje": "Cargo creado"}


# Punto de partida sugerido. NO es un catalogo global de BERISA a proposito:
# ninguna norma chilena define cuales son los cargos, asi que BERISA no puede
# afirmar un estandar como si lo hace con los requisitos, donde cada uno cita su
# decreto. Se crean como cargos PROPIOS del mandante para que los renombre o los
# borre sin pedir permiso.
#
# Cinco y no quince: la matriz cargo x requisito solo sirve si se lee de un
# vistazo. Cada uno esta elegido porque implica documentos distintos, no por
# completar un organigrama.
SET_SUGERIDO = [
    ("ADMINISTRATIVO",  "Administrativo",      "ADMINISTRACION"),
    ("TERRENO",         "Personal de terreno", "OPERACIONES"),
    ("SUPERVISOR",      "Supervisor",          "OPERACIONES"),
    ("CONDUCTOR",       "Conductor",           "OPERACIONES"),
    ("OPERADOR_EQUIPO", "Operador de equipo",  "OPERACIONES"),
]


@router.post("/set-sugerido", status_code=status.HTTP_201_CREATED)
def crear_set_sugerido(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_rol(["mandante_admin"])),
):
    """
    Crea de una vez un punto de partida de cargos para el mandante.

    Idempotente: los codigos que ya existan se saltan, asi que apretarlo dos
    veces no duplica ni falla. Sirve tambien para recuperar uno borrado.
    """
    mandante_id = usuario.mandante_id
    existentes = {
        c.codigo for c in db.query(Cargo).filter_by(mandante_id=mandante_id).all()
    }
    # Un codigo del catalogo global tampoco se puede pisar.
    globales = {c.codigo for c in db.query(Cargo).filter_by(mandante_id=None).all()}

    creados = []
    for codigo, nombre, area in SET_SUGERIDO:
        if codigo in existentes or codigo in globales:
            continue
        db.add(Cargo(mandante_id=mandante_id, codigo=codigo, nombre=nombre, area=area))
        creados.append(codigo)
    db.commit()
    return {
        "mensaje": f"{len(creados)} cargo(s) creado(s)",
        "creados": creados,
        "omitidos": [c for c, _, _ in SET_SUGERIDO if c not in creados],
    }


@router.patch("/{cargo_id}")
def actualizar_cargo(
    cargo_id: uuid.UUID,
    body: ActualizarCargoRequest,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_rol(["berisa_admin", "mandante_admin"])),
):
    """El mandante_admin solo puede tocar sus cargos propios, nunca el global."""
    cargo = db.get(Cargo, cargo_id)
    if not cargo:
        raise HTTPException(status_code=404, detail="Cargo no encontrado")
    if usuario.rol == "mandante_admin" and cargo.mandante_id != usuario.mandante_id:
        raise HTTPException(status_code=403, detail="Solo puede editar cargos propios de su organización")

    if body.nombre is not None:
        cargo.nombre = body.nombre.strip()
    if body.area is not None:
        cargo.area = body.area.strip().upper() or None
    if body.activo is not None:
        # Baja lógica: hay asignaciones históricas apuntando a este cargo y
        # borrarlo las dejaría colgando.
        cargo.activo = body.activo
    db.commit()
    return {"mensaje": "Cargo actualizado"}


@router.delete("/{cargo_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_cargo(
    cargo_id: uuid.UUID,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_rol(["berisa_admin", "mandante_admin"])),
):
    """
    Borra el cargo solo si nadie lo usa. Si está en uso, se responde 400 con el
    detalle: desactivarlo es la vía correcta y la sugiere el mensaje.
    """
    cargo = db.get(Cargo, cargo_id)
    if not cargo:
        raise HTTPException(status_code=404, detail="Cargo no encontrado")
    if usuario.rol == "mandante_admin" and cargo.mandante_id != usuario.mandante_id:
        raise HTTPException(status_code=403, detail="Solo puede eliminar cargos propios de su organización")

    en_asignaciones = db.query(ServicioTrabajador).filter_by(cargo_id=cargo_id).count()
    en_perfiles = db.query(PerfilRequisitoCargo).filter_by(cargo_id=cargo_id).count()
    if en_asignaciones or en_perfiles:
        raise HTTPException(
            status_code=400,
            detail=(
                f"El cargo está en uso ({en_asignaciones} asignación(es), "
                f"{en_perfiles} requisito(s) configurado(s)). Desactívalo en vez de borrarlo."
            ),
        )
    db.delete(cargo)
    db.commit()
