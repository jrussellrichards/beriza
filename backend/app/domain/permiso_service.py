"""
Permisos de aprobación por pilar (portal del mandante).

Un mandante organiza la revisión por departamento: el prevencionista aprueba HSE,
finanzas aprueba Compliance, RRHH aprueba Legal/Laboral. Este módulo resuelve
"¿puede este usuario aprobar este documento?" según el pilar al que pertenece.

Solo gobierna APROBAR — ver no se restringe dentro del mandante. Ver el docstring
de `UsuarioPilarPermiso` para el razonamiento.
"""
import uuid

from sqlalchemy.orm import Session

from app.core.exceptions import PermisoInsuficiente
from app.models.expediente import Acreditacion
from app.models.permiso import UsuarioPilarPermiso
from app.models.pilar import Pilar
from app.models.usuario import Usuario

# Roles que aprueban cualquier pilar sin necesitar permisos explícitos.
ROLES_SIN_RESTRICCION = ("berisa_admin", "mandante_admin")


def pilares_que_aprueba(db: Session, usuario: Usuario) -> list[Pilar] | None:
    """
    Pilares que este usuario puede aprobar. `None` significa "todos" — no es lo
    mismo que una lista vacía, que significa "ninguno".
    """
    if usuario.rol in ROLES_SIN_RESTRICCION:
        return None
    permisos = db.query(UsuarioPilarPermiso).filter_by(usuario_id=usuario.id).all()
    return [p.pilar for p in permisos]


def puede_aprobar(db: Session, usuario: Usuario, acreditacion: Acreditacion) -> bool:
    """¿Puede este usuario resolver la revisión de esta acreditación?"""
    if usuario.rol in ROLES_SIN_RESTRICCION:
        return True
    pilar_del_doc = acreditacion.expediente.requisito.subpilar.pilar_id
    return db.query(UsuarioPilarPermiso).filter_by(
        usuario_id=usuario.id, pilar_id=pilar_del_doc
    ).first() is not None


def exigir_puede_aprobar(db: Session, usuario: Usuario, acreditacion: Acreditacion) -> None:
    """Lanza PermisoInsuficiente con el nombre del pilar, que es lo accionable."""
    if puede_aprobar(db, usuario, acreditacion):
        return
    pilar = acreditacion.expediente.requisito.subpilar.pilar
    raise PermisoInsuficiente(
        f"No tienes permiso para aprobar documentos del pilar {pilar.nombre}. "
        "Pídele a un administrador de tu organización que te lo asigne."
    )


def definir_permisos(
    db: Session, usuario_id: uuid.UUID, mandante_id: uuid.UUID, pilar_ids: list[uuid.UUID]
) -> list[UsuarioPilarPermiso]:
    """
    Reemplaza los permisos del usuario por la lista indicada.

    Se valida que el usuario pertenezca al mandante que hace el cambio: sin eso,
    un mandante_admin podría otorgarse permisos sobre usuarios de otra empresa.
    """
    objetivo = db.get(Usuario, usuario_id)
    if not objetivo or objetivo.mandante_id != mandante_id:
        raise PermisoInsuficiente("El usuario no pertenece a tu organización.")
    if objetivo.rol in ROLES_SIN_RESTRICCION:
        raise PermisoInsuficiente(
            f"Un {objetivo.rol} ya aprueba cualquier pilar; no necesita permisos por pilar."
        )

    db.query(UsuarioPilarPermiso).filter_by(usuario_id=usuario_id).delete()
    nuevos = [UsuarioPilarPermiso(usuario_id=usuario_id, pilar_id=pid) for pid in pilar_ids]
    db.add_all(nuevos)
    db.commit()
    return nuevos
