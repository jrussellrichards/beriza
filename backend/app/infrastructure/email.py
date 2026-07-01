from abc import ABC, abstractmethod
from dataclasses import dataclass

import resend

from app.core.config import settings


@dataclass
class Email:
    destinatario: str
    asunto: str
    cuerpo_html: str


class EmailClienteBase(ABC):
    """
    Interfaz de email. Permite intercambiar Resend por otro
    proveedor sin tocar el dominio.
    """

    @abstractmethod
    def enviar(self, email: Email) -> None:
        ...


class EmailClienteResend(EmailClienteBase):
    """Implementación con Resend (resend.com)."""

    def __init__(self):
        resend.api_key = settings.RESEND_API_KEY

    def enviar(self, email: Email) -> None:
        resend.Emails.send({
            "from": "Acredita <noreply@acredita.cl>",
            "to": [email.destinatario],
            "subject": email.asunto,
            "html": email.cuerpo_html,
        })


class EmailClienteConsola(EmailClienteBase):
    """
    Implementación para desarrollo local.
    Imprime el email en consola en vez de enviarlo.
    """

    def enviar(self, email: Email) -> None:
        print(f"\n{'='*60}")
        print(f"[EMAIL] Para: {email.destinatario}")
        print(f"[EMAIL] Asunto: {email.asunto}")
        print(f"[EMAIL] Cuerpo:\n{email.cuerpo_html}")
        print(f"{'='*60}\n")


def get_email_cliente() -> EmailClienteBase:
    """
    Factory que retorna la implementación correcta según ENVIRONMENT en .env.
    En development retorna EmailClienteConsola, en production EmailClienteResend.
    """
    if settings.ENVIRONMENT == "production":
        return EmailClienteResend()
    return EmailClienteConsola()
