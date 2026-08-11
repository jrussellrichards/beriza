import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import ModelBase


class TokenRecuperacion(ModelBase):
    """
    Token de un solo uso para restablecer la contraseña.

    Deliberadamente NO reutiliza el mecanismo de activación. Ahí el token es el
    propio `usuario.id`, que no es un secreto: viaja en enlaces de invitación, en
    respuestas de la API y en la URL. Eso alcanza para activar una cuenta que
    todavía no tiene contraseña, pero sería un desastre para recuperar una que sí
    la tiene.

    Por eso acá el token es aleatorio, expira y se quema al usarse, y en la base
    se guarda sólo su SHA-256: si alguien lee esta tabla no obtiene nada con lo
    que pueda restablecer una contraseña.
    """
    __tablename__ = "tokens_recuperacion"

    usuario_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("usuarios.id"), nullable=False, index=True
    )
    # SHA-256 en hexadecimal del token que viajó por email. Nunca el token.
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    expira_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    # Sella el uso: un token consumido no sirve una segunda vez.
    usado_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
