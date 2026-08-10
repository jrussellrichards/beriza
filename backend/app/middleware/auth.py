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

    usuario = db.get(Usuario, usuario_id)
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
