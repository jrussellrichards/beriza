import uuid
from typing import Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import PermisoInsuficiente
from app.infrastructure.database import get_db
from app.models.usuario import Usuario

bearer_scheme = HTTPBearer()


def get_usuario_actual(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> Usuario:
    """
    Valida el JWT del header Authorization: Bearer <token>.
    Retorna el objeto Usuario activo o lanza 401.
    Nunca retorna un usuario con activo=False.
    """
    credenciales_invalidas = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciales inválidas",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
        )
        usuario_id: str = payload.get("sub")
        if not usuario_id:
            raise credenciales_invalidas
    except JWTError:
        raise credenciales_invalidas

    # El `sub` del JWT es texto y la columna es UUID. Postgres lo adapta solo,
    # asi que en produccion nunca se noto; con SQLite —el motor del entorno de
    # desarrollo sin Docker y el de toda la suite de tests— revienta con
    # "'str' object has no attribute 'hex'" y devuelve un 500 en cada request
    # autenticado. Convertirlo aca lo deja explicito para cualquier motor.
    try:
        usuario = db.get(Usuario, uuid.UUID(usuario_id))
    except ValueError:
        # Un sub que no es un UUID es un token invalido, no un error del servidor.
        raise credenciales_invalidas
    if not usuario or not usuario.activo:
        raise credenciales_invalidas

    return usuario


def require_rol(roles: list[str]) -> Callable:
    """
    Factoría de dependencias: retorna una función que valida que el usuario
    autenticado tenga uno de los roles permitidos.

    Uso: usuario=Depends(require_rol(["mandante_admin", "berisa_admin"]))
    Lanza 403 si el rol no está en la lista.
    """
    def _verificar(usuario: Usuario = Depends(get_usuario_actual)) -> Usuario:
        if usuario.rol not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Se requiere uno de estos roles: {', '.join(roles)}",
            )
        return usuario

    return _verificar


def exigir_mandante_propio(usuario: Usuario, mandante_id) -> None:
    """
    El usuario solo puede operar sobre el mandante de la ruta si es el suyo.

    Existe porque `require_rol` valida ÚNICAMENTE el string del rol, y eso no
    alcanza en un producto multi-tenant: dos mandantes distintos tienen los dos
    el rol `mandante_admin`, así que la ruta quedaba abierta a cualquiera que
    cambiara el UUID en la URL. Diez de los diecisiete endpoints con
    {mandante_id} no lo validaban, incluidos POST que escribían en el tenant
    ajeno.

    berisa_admin pasa siempre: opera la plataforma completa. Se reconoce por
    mandante_id NULL + rol, nunca solo por el NULL — un mandante_admin con
    mandante_id nulo sería un superadministrador accidental.
    """
    if usuario.rol == "berisa_admin":
        return
    if usuario.mandante_id is None or usuario.mandante_id != mandante_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No puedes operar sobre otra organización.",
        )


def exigir_acceso_a_contratista(db: Session, usuario: Usuario, empresa_id) -> None:
    """
    Quién puede leer los datos de una empresa contratista, incluida su nómina.

    Son exactamente tres: BERISA, la propia empresa, y un mandante que la haya
    contratado. Nadie más — y en particular NO cualquier usuario autenticado.

    Existe porque `require_rol` valida sólo el string del rol, igual que en
    `exigir_mandante_propio`, y acá el descuido costaba más caro: la nómina son
    datos personales. `GET /trabajadores/empresa/{empresa_id}` era literalmente
    `filter_by(empresa_id=...)`, así que un mandante leía la dotación completa
    —RUT, nombre y cargo— de un contratista de la competencia con sólo cambiar
    el UUID.

    Y ese UUID no es secreto: viaja al navegador del contratista y el mandante lo
    ve en su propio listado de contratistas. Basta haber trabajado una vez con la
    empresa para conservarlo y seguir leyendo su gente para siempre, aun terminado
    el contrato. Por eso el vínculo se comprueba contra la tabla en cada llamada
    en vez de confiar en que quien tiene el id tenía derecho a tenerlo.
    """
    from app.models.contratista import ContratistaMandante

    if usuario.rol == "berisa_admin":
        return

    # La propia empresa.
    if usuario.contratista_id is not None and usuario.contratista_id == empresa_id:
        return

    # Un mandante que la contrató. Se exige mandante_id no nulo antes de
    # consultar: con NULL, filter_by devolvería la relación equivocada o ninguna,
    # y la intención —"pertenece a mi organización"— dejaría de estar expresada.
    if usuario.mandante_id is not None:
        vinculo = (
            db.query(ContratistaMandante)
            .filter_by(mandante_id=usuario.mandante_id, contratista_id=empresa_id)
            .first()
        )
        if vinculo is not None:
            return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="No puedes ver los datos de esta empresa contratista.",
    )


def mandante_propio(roles: list[str]) -> Callable:
    """
    Dependencia para rutas con {mandante_id}: valida rol Y pertenencia.

    Uso: usuario = Depends(mandante_propio(["berisa_admin", "mandante_admin"]))
    Reemplaza a require_rol en toda ruta que lleve mandante_id, para que no se
    pueda olvidar la mitad de la validación.
    """
    def _verificar(
        mandante_id: uuid.UUID,
        usuario: Usuario = Depends(require_rol(roles)),
    ) -> Usuario:
        exigir_mandante_propio(usuario, mandante_id)
        return usuario

    return _verificar
