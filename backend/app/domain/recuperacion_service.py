"""
Recuperación de contraseña.

Separado de usuario_service porque el problema es otro: allá se decide quién
puede administrar a quién, acá se administra el ciclo de vida de un secreto.

La regla que gobierna todo este módulo es que restablecer la contraseña NO es
una vía para recuperar acceso revocado. Una cuenta desactivada por un
administrador no puede volver por acá; si pudiera, sería el mismo agujero que ya
cerramos en `activar_cuenta`, con otra puerta.
"""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.exceptions import AcreditaError
from app.models.token_recuperacion import TokenRecuperacion
from app.models.usuario import Usuario

# Una hora. Suficiente para que alguien lea su correo y no tanto como para que un
# enlace olvidado en la bandeja siga sirviendo días después.
VIGENCIA = timedelta(hours=1)

# Mínimo de la contraseña nueva. Igual que en la activación: no se endurece acá
# una regla que la otra puerta no exige, o el usuario descubre el requisito recién
# al final del flujo más incómodo.
LARGO_MINIMO = 8


class TokenRecuperacionInvalido(AcreditaError):
    """El token no existe, ya se usó o expiró."""


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def puede_recuperar(usuario: Usuario) -> bool:
    """
    Sólo una cuenta viva y ya activada.

    Las dos exclusiones importan:

    - `activo=False` cubre a la cuenta REVOCADA. Si un administrador te quitó el
      acceso, no te lo devuelves pidiendo un correo.
    - Sin `password_hash` es una invitación que nunca se completó. Esa persona no
      tiene contraseña que restablecer: su camino es el enlace de activación, y
      dejarla entrar por acá duplicaría el alta en un flujo que no pide los datos
      de la organización.
    """
    return bool(usuario.activo) and bool(usuario.password_hash)


def emitir_token(db: Session, usuario: Usuario) -> str:
    """
    Crea un token nuevo y devuelve el valor EN CLARO, que es lo único que puede
    viajar por email. En la base queda sólo el hash.

    Invalida los anteriores sin usar: si pediste el enlace tres veces, sirve el
    último. Sin esto cada pedido dejaba una llave viva más.
    """
    ahora = datetime.now(timezone.utc)
    (
        db.query(TokenRecuperacion)
        .filter(
            TokenRecuperacion.usuario_id == usuario.id,
            TokenRecuperacion.usado_en.is_(None),
        )
        .update({"usado_en": ahora}, synchronize_session=False)
    )

    token = secrets.token_urlsafe(32)
    db.add(TokenRecuperacion(
        usuario_id=usuario.id,
        token_hash=_hash(token),
        expira_en=ahora + VIGENCIA,
    ))
    db.commit()
    return token


def consumir_token(db: Session, token: str) -> Usuario:
    """
    Valida el token, lo quema y devuelve a su dueño.

    Se quema ANTES de que el llamador escriba la contraseña nueva y en la misma
    transacción, para que un token no pueda usarse dos veces.
    """
    registro = db.query(TokenRecuperacion).filter_by(token_hash=_hash(token)).first()
    if not registro or registro.usado_en is not None:
        raise TokenRecuperacionInvalido(
            "El enlace no es válido o ya fue usado. Pide uno nuevo."
        )

    # La columna vuelve de Postgres con tzinfo, pero de SQLite sin él. Comparar
    # sin normalizar revienta con TypeError en los tests.
    expira = registro.expira_en
    if expira.tzinfo is None:
        expira = expira.replace(tzinfo=timezone.utc)
    if expira < datetime.now(timezone.utc):
        raise TokenRecuperacionInvalido("El enlace expiró. Pide uno nuevo.")

    usuario = db.get(Usuario, registro.usuario_id)
    if not usuario or not puede_recuperar(usuario):
        # Se revocó la cuenta entre que pidió el enlace y lo abrió.
        raise TokenRecuperacionInvalido(
            "El enlace no es válido o ya fue usado. Pide uno nuevo."
        )

    registro.usado_en = datetime.now(timezone.utc)
    return usuario


def exigir_password_aceptable(password: str) -> None:
    if len(password or "") < LARGO_MINIMO:
        raise AcreditaError(
            f"La contraseña debe tener al menos {LARGO_MINIMO} caracteres."
        )
