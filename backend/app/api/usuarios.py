import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from jose import jwt
from sqlalchemy.orm import Session

from app.api.schemas import (
    ActivarCuentaRequest,
    CrearUsuarioRequest,
    InvitacionInfoResponse,
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
    # `mandante_id` solo aplica a usuarios DE un mandante. Antes, para un
    # contratista, se metía aquí "el primer vínculo" con un .first() sin
    # order_by: un contratista con tres clientes veía uno al azar y sin forma de
    # cambiarlo, y todo su portal quedaba cableado a ese. Un contratista no
    # pertenece a un mandante — trabaja para varios. Sus endpoints se derivan de
    # contratista_id (ver /mis-documentos y /mi-resumen).
    #
    # El backend nunca leyó este claim: get_usuario_actual carga el Usuario de
    # la BD por `sub`, así que quitarlo no afecta autorización.
    payload = {
        "sub": str(usuario.id),
        "rol": usuario.rol,
        "mandante_id": str(usuario.mandante_id) if usuario.mandante_id else None,
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


@router.get("/invitacion/{token}", response_model=InvitacionInfoResponse)
def obtener_invitacion(token: str, db: Session = Depends(get_db)):
    """
    Datos de la invitación pendiente para prellenar el formulario de
    activación -- el contratista corrige/completa en vez de reescribir
    a ciegas lo que el mandante ya ingresó al invitar.
    """
    try:
        usuario_id = uuid.UUID(token)
    except ValueError:
        raise HTTPException(status_code=400, detail="Token inválido")

    usuario = db.get(Usuario, usuario_id)
    if not usuario or usuario.activo:
        raise HTTPException(status_code=400, detail="Token inválido o cuenta ya activada")

    empresa = db.query(EmpresaContratista).filter_by(id=usuario.contratista_id).first()
    if not empresa:
        raise HTTPException(status_code=404, detail="Invitación no encontrada")

    relacion = (
        db.query(ContratistaMandante)
        .filter_by(contratista_id=empresa.id)
        .order_by(ContratistaMandante.created_at.desc())
        .first()
    )

    return InvitacionInfoResponse(
        email=usuario.email,
        razon_social=empresa.razon_social,
        rut=empresa.rut,
        giro=empresa.giro,
        mandante_razon_social=relacion.mandante.razon_social if relacion else "",
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
        if body.rut != empresa.rut:
            conflicto = db.query(EmpresaContratista).filter(
                EmpresaContratista.rut == body.rut,
                EmpresaContratista.id != empresa.id,
            ).first()
            if conflicto:
                raise HTTPException(
                    status_code=400,
                    detail=f"El RUT {body.rut} ya está registrado por otra empresa "
                           f"({conflicto.razon_social}). Verifica el RUT ingresado.",
                )
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
