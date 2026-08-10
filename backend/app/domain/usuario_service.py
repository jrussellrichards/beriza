"""
Gestión del ciclo de vida de los usuarios: quién puede tocar a quién y qué
significa "eliminar".

Toda la autorización sobre usuarios vive acá y no repartida por los routers. Es
la misma razón por la que existe permiso_service: cuando la regla se copia en
cada endpoint, tarde o temprano uno se olvida y aparece un camino por el que un
mandante edita a alguien de otro.
"""
import uuid

from sqlalchemy.orm import Session

from app.core.exceptions import PermisoInsuficiente
from app.models.usuario import Usuario

# Roles que cada tipo de administrador puede otorgar. Un mandante_admin no puede
# fabricar un berisa_admin, y un contratista_admin no puede crear usuarios del
# mandante: el alta de roles siempre es hacia dentro de la propia organización.
ROLES_QUE_PUEDE_OTORGAR = {
    "berisa_admin": ("berisa_admin", "mandante_admin", "contratista_admin", "prevencionista"),
    "mandante_admin": ("mandante_admin", "prevencionista"),
    # `prevencionista` se reutiliza del lado contratista mientras no exista un rol
    # propio. Es deuda consciente: el rol nació pensado para el mandante y su
    # nombre no calza del todo con alguien que SUBE documentos en vez de
    # revisarlos. Lo que lo hace correcto hoy es que la autorización real no
    # depende del nombre del rol sino de contratista_id, que lo deja encerrado en
    # su propia empresa.
    "contratista_admin": ("contratista_admin", "prevencionista"),
}


def nunca_activo(usuario: Usuario) -> bool:
    """
    Invitación que jamás se completó. `activar_cuenta` es lo único que escribe
    password_hash, así que vacío significa que esta persona nunca entró y no
    tiene nada en la bitácora de auditoría.
    """
    return not usuario.password_hash


def puede_gestionar(actor: Usuario, objetivo: Usuario) -> bool:
    """
    ¿Puede `actor` administrar la cuenta de `objetivo`?

    BERISA sobre cualquiera; el mandante_admin sobre los de su mandante; el
    contratista_admin sobre los de su contratista. Nadie cruza el borde de su
    organización.
    """
    if actor.rol == "berisa_admin":
        return True
    if actor.rol == "mandante_admin":
        return objetivo.mandante_id is not None and objetivo.mandante_id == actor.mandante_id
    if actor.rol == "contratista_admin":
        return objetivo.contratista_id is not None and objetivo.contratista_id == actor.contratista_id
    return False


def exigir_puede_gestionar(actor: Usuario, objetivo: Usuario) -> None:
    if not puede_gestionar(actor, objetivo):
        raise PermisoInsuficiente(
            "No puedes administrar usuarios de otra organización."
        )


def exigir_no_es_uno_mismo(actor: Usuario, objetivo: Usuario, accion: str) -> None:
    """
    Nadie se desactiva, se borra ni se cambia el rol a sí mismo.

    No es paternalismo: un admin que se quita el rol por error queda sin forma de
    devolvérselo, y hay que arreglarlo por SQL en la base de producción.
    """
    if actor.id == objetivo.id:
        raise PermisoInsuficiente(
            f"No puedes {accion} tu propia cuenta. Pídeselo a otro administrador."
        )


def exigir_no_es_ultimo_admin(db: Session, objetivo: Usuario) -> None:
    """
    Una organización no puede quedarse sin nadie que la administre.

    Sin esta guarda, desactivar o degradar al único administrador deja al
    mandante sin poder invitar gente ni tocar sus perfiles, y sin camino de
    vuelta desde la interfaz.
    """
    if objetivo.rol == "mandante_admin" and objetivo.mandante_id:
        otros = (
            db.query(Usuario)
            .filter(
                Usuario.mandante_id == objetivo.mandante_id,
                Usuario.rol == "mandante_admin",
                Usuario.activo.is_(True),
                Usuario.id != objetivo.id,
            )
            .count()
        )
        if otros == 0:
            raise PermisoInsuficiente(
                "Es el único administrador activo del mandante. Nombra a otro antes."
            )
    if objetivo.rol == "contratista_admin" and objetivo.contratista_id:
        otros = (
            db.query(Usuario)
            .filter(
                Usuario.contratista_id == objetivo.contratista_id,
                Usuario.rol == "contratista_admin",
                Usuario.activo.is_(True),
                Usuario.id != objetivo.id,
            )
            .count()
        )
        if otros == 0:
            raise PermisoInsuficiente(
                "Es el único administrador activo de la empresa. Nombra a otro antes."
            )
    if objetivo.rol == "berisa_admin":
        otros = (
            db.query(Usuario)
            .filter(
                Usuario.rol == "berisa_admin",
                Usuario.activo.is_(True),
                Usuario.id != objetivo.id,
            )
            .count()
        )
        if otros == 0:
            raise PermisoInsuficiente(
                "Es el único administrador activo de BERISA."
            )


def exigir_rol_otorgable(actor: Usuario, rol: str) -> None:
    permitidos = ROLES_QUE_PUEDE_OTORGAR.get(actor.rol, ())
    if rol not in permitidos:
        raise PermisoInsuficiente(
            f"No puedes asignar el rol {rol}. Puedes asignar: {', '.join(permitidos)}."
        )
