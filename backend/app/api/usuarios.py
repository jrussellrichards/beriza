import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from jose import jwt
from sqlalchemy.orm import Session

from app.api.schemas import (
    ActivarCuentaRequest,
    CrearUsuarioRequest,
    LoginRequest,
    TokenResponse,
    UsuarioResponse,
)
from app.core.config import settings
from app.core.exceptions import PermisoInsuficiente
from app.core.security import hash_password, verify_password
from app.infrastructure.database import get_db
from app.middleware.auth import get_usuario_actual, require_rol
from app.models.contratista import ContratistaMandante, EmpresaContratista
from app.models.usuario import Usuario

router = APIRouter()

ROLES_CREABLES = {
    "berisa_admin": ["berisa_admin", "mandante_admin", "contratista_admin", "prevencionista"],
    "mandante_admin": ["mandante_admin"],
    "contratista_admin": ["prevencionista"],
}


def _crear_token(usuario: Usuario, db: Session | None = None) -> str:
    mandante_id = usuario.mandante_id

    # Para contratistas: incluir el primer mandante activo en el token
    # para que el frontend sepa ante quién está acreditando
    if not mandante_id and usuario.contratista_id and db:
        from app.models.contratista import ContratistaMandante
        vinculo = db.query(ContratistaMandante).filter_by(
            contratista_id=usuario.contratista_id
        ).first()
        if vinculo:
            mandante_id = vinculo.mandante_id

    payload = {
        "sub": str(usuario.id),
        "rol": usuario.rol,
        "mandante_id": str(mandante_id) if mandante_id else None,
        "contratista_id": str(usuario.contratista_id) if usuario.contratista_id else None,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    """
    Autentica con email y password. Retorna JWT con rol, mandante_id
    o contratista_id según el tipo de usuario.
    """
    usuario = db.query(Usuario).filter_by(email=body.email, activo=True).first()
    if not usuario or not verify_password(body.password, usuario.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales incorrectas")

    return TokenResponse(
        access_token=_crear_token(usuario, db),
        rol=usuario.rol,
        mandante_id=usuario.mandante_id,
        contratista_id=usuario.contratista_id,
    )


@router.post("/activar", response_model=TokenResponse)
def activar_cuenta(body: ActivarCuentaRequest, db: Session = Depends(get_db)):
    """
    Activa la cuenta de un contratista invitado. Recibe el token del email
    de invitación, la contraseña elegida y los datos básicos de la empresa.
    El token es el usuario_id enviado en la invitación.
    """
    try:
        usuario_id = uuid.UUID(body.token)
    except ValueError:
        raise HTTPException(status_code=400, detail="Token inválido")

    usuario = db.get(Usuario, usuario_id)
    if not usuario or usuario.activo:
        raise HTTPException(status_code=400, detail="Token inválido o cuenta ya activada")

    empresa = db.query(EmpresaContratista).filter_by(id=usuario.contratista_id).first()
    if empresa:
        empresa.razon_social = body.razon_social
        empresa.rut = body.rut
        empresa.giro = body.giro

    usuario.password_hash = hash_password(body.password)
    usuario.activo = True
    db.commit()

    return TokenResponse(
        access_token=_crear_token(usuario, db),
        rol=usuario.rol,
        mandante_id=usuario.mandante_id,
        contratista_id=usuario.contratista_id,
    )


@router.get("/me", response_model=UsuarioResponse)
def obtener_usuario_actual(
    usuario: Usuario = Depends(require_rol(["berisa_admin", "mandante_admin", "contratista_admin", "prevencionista"])),
):
    """Retorna los datos del usuario autenticado y su contexto (mandante o contratista)."""
    return usuario


@router.post("/", response_model=UsuarioResponse, status_code=status.HTTP_201_CREATED)
def crear_usuario(
    body: CrearUsuarioRequest,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(require_rol(["berisa_admin", "mandante_admin", "contratista_admin"])),
):
    """
    Crea un usuario adicional dentro del mismo mandante o contratista.
    berisa_admin puede crear cualquier rol.
    mandante_admin solo puede crear mandante_admin.
    contratista_admin solo puede crear prevencionista.
    """
    roles_permitidos = ROLES_CREABLES.get(usuario.rol, [])
    if body.rol not in roles_permitidos:
        raise HTTPException(status_code=403, detail=f"No puede crear usuarios con rol '{body.rol}'")

    if db.query(Usuario).filter_by(email=body.email).first():
        raise HTTPException(status_code=400, detail="El email ya está registrado")

    nuevo = Usuario(
        email=body.email,
        nombre=body.nombre,
        password_hash=hash_password(body.password),
        rol=body.rol,
        activo=True,
        mandante_id=usuario.mandante_id,
        contratista_id=usuario.contratista_id,
    )
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo
