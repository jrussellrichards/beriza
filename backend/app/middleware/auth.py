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
