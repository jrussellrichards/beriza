"""
Permisos de aprobación por pilar (portal del mandante).

Un mandante organiza la revisión por departamento: el prevencionista aprueba HSE,
finanzas aprueba Compliance, RRHH aprueba Legal/Laboral. Este módulo resuelve
"¿puede este usuario aprobar este documento?" según el pilar al que pertenece.

Solo gobierna APROBAR — ver no se restringe dentro del mandante. Ver el docstring
de `UsuarioPilarPermiso` para el razonamiento.

El ALCANCE de aprobación es independiente de si la persona ADMINISTRA la cuenta.
Son dos preguntas y antes estaban fusionadas en el rol: para que alguien aprobara
todos los pilares había que hacerlo mandante_admin, lo que además le entregaba
invitar gente y reconfigurar los perfiles de exigencias. Hoy:

    rol=mandante_admin              -> administra Y aprueba todo (por el rol)
    rol=prevencionista, aprueba_todo -> aprueba todo, NO administra
    rol=prevencionista + N pilares   -> aprueba esos pilares
    rol=prevencionista + 0 pilares   -> no aprueba nada, solo revisa
"""
import uuid

from sqlalchemy.orm import Session

from app.core.exceptions import PermisoInsuficiente
from app.models.expediente import Acreditacion
from app.models.permiso import UsuarioPilarPermiso
from app.models.pilar import Pilar
from app.models.usuario import Usuario

# Roles que aprueban cualquier pilar por definición del rol, sin necesitar filas
# de permiso ni la marca `aprueba_todo`.
ROLES_SIN_RESTRICCION = ("berisa_admin", "mandante_admin")


def aprueba_cualquier_pilar(usuario: Usuario) -> bool:
    """
    ¿Aprueba todos los pilares? Por el rol (administra la cuenta) o por alcance
    explícito (`aprueba_todo`), que es el revisor senior que no administra.

    Único lugar donde se combinan las dos vías: si se comparan por separado en
    cada llamador, tarde o temprano una de ellas se olvida y aparece un usuario
    que aprueba en un endpoint y no en otro.
    """
    return usuario.rol in ROLES_SIN_RESTRICCION or bool(usuario.aprueba_todo)


def pilares_que_aprueba(db: Session, usuario: Usuario) -> list[Pilar] | None:
    """
    Pilares que este usuario puede aprobar. `None` significa "todos" — no es lo
    mismo que una lista vacía, que significa "ninguno".
    """
    if aprueba_cualquier_pilar(usuario):
        return None
    permisos = db.query(UsuarioPilarPermiso).filter_by(usuario_id=usuario.id).all()
    return [p.pilar for p in permisos]


def puede_aprobar(db: Session, usuario: Usuario, acreditacion: Acreditacion) -> bool:
    """¿Puede este usuario resolver la revisión de esta acreditación?"""
    if aprueba_cualquier_pilar(usuario):
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
    db: Session,
    usuario_id: uuid.UUID,
    mandante_id: uuid.UUID,
    pilar_ids: list[uuid.UUID],
    aprueba_todo: bool = False,
) -> list[UsuarioPilarPermiso]:
    """
    Reemplaza el alcance de aprobación del usuario.

    Se valida que el usuario pertenezca al mandante que hace el cambio: sin eso,
    un mandante_admin podría otorgarse permisos sobre usuarios de otra empresa.
    """
    objetivo = db.get(Usuario, usuario_id)
    if not objetivo or objetivo.mandante_id != mandante_id:
        raise PermisoInsuficiente("El usuario no pertenece a tu organización.")
    if objetivo.rol in ROLES_SIN_RESTRICCION:
        raise PermisoInsuficiente(
            f"Un {objetivo.rol} ya aprueba cualquier pilar por su rol; "
            "para limitarle el alcance hay que cambiarle el rol, no los pilares."
        )

    objetivo.aprueba_todo = aprueba_todo
    # Las filas por pilar se borran SIEMPRE, también al marcar aprueba_todo: dos
    # mecanismos que expresan el mismo permiso terminan contradiciéndose y hacen
    # imposible responder "¿por qué esta persona aprueba esto?". Si vuelve a
    # alcance parcial, se eligen de nuevo.
    db.query(UsuarioPilarPermiso).filter_by(usuario_id=usuario_id).delete()
    nuevos = (
        []
        if aprueba_todo
        else [UsuarioPilarPermiso(usuario_id=usuario_id, pilar_id=pid) for pid in pilar_ids]
    )
    db.add_all(nuevos)
    db.commit()
    return nuevos
