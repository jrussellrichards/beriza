"""
Recuperación de contraseña.

El test que da sentido al archivo es `test_cuenta_revocada_no_puede_recuperar`.
Todo lo demás es higiene del token; ese es el que evita que este flujo nuevo
reabra, por otra puerta, el agujero de secuestro de cuentas que ya cerramos en
`activar_cuenta`.

Corre contra SQLite en memoria, sin DB externa.
"""
import os
import sys
import uuid
from datetime import datetime, timedelta, timezone

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ.setdefault("DATABASE_URL", "postgresql://x:x@localhost/x")
os.environ.setdefault("JWT_SECRET", "test")

import pytest
from sqlalchemy.orm import Session

import app.models  # noqa: F401 — registra los modelos
from app.models.base import Base
from app.models.token_recuperacion import TokenRecuperacion
from app.models.usuario import Usuario
from app.domain import recuperacion_service as rec

from tests._db import engine_sqlite


def _db():
    engine = engine_sqlite(connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    return Session(engine)


def _usuario(db, activo=True, password_hash="$2b$12$hashreal"):
    u = Usuario(
        id=uuid.uuid4(), email=f"{uuid.uuid4().hex[:8]}@t.cl", nombre="T",
        rol="prevencionista", activo=activo, password_hash=password_hash,
    )
    db.add(u)
    db.commit()
    return u


# ── Quién puede recuperar ────────────────────────────────────────────────────

def test_cuenta_activa_puede_recuperar():
    db = _db()
    assert rec.puede_recuperar(_usuario(db)) is True


def test_cuenta_revocada_no_puede_recuperar():
    """
    El caso que importa. Un administrador te quitó el acceso: no te lo devuelves
    pidiendo un correo. Sin esto, /recuperar sería un rodeo para deshacer un
    DELETE.
    """
    db = _db()
    assert rec.puede_recuperar(_usuario(db, activo=False)) is False


def test_invitacion_pendiente_no_puede_recuperar():
    """Sin contraseña no hay nada que restablecer: su camino es activar."""
    db = _db()
    assert rec.puede_recuperar(_usuario(db, password_hash="")) is False


# ── Ciclo de vida del token ─────────────────────────────────────────────────

def test_el_token_en_claro_no_queda_en_la_base():
    db = _db()
    u = _usuario(db)
    token = rec.emitir_token(db, u)
    guardados = [t.token_hash for t in db.query(TokenRecuperacion).all()]
    assert token not in guardados
    assert len(guardados[0]) == 64  # sha256 hex


def test_token_valido_devuelve_a_su_dueno():
    db = _db()
    u = _usuario(db)
    token = rec.emitir_token(db, u)
    assert rec.consumir_token(db, token).id == u.id


def test_token_no_sirve_dos_veces():
    db = _db()
    u = _usuario(db)
    token = rec.emitir_token(db, u)
    rec.consumir_token(db, token)
    db.commit()
    with pytest.raises(rec.TokenRecuperacionInvalido):
        rec.consumir_token(db, token)


def test_token_expirado_se_rechaza():
    db = _db()
    u = _usuario(db)
    token = rec.emitir_token(db, u)
    registro = db.query(TokenRecuperacion).first()
    registro.expira_en = datetime.now(timezone.utc) - timedelta(minutes=1)
    db.commit()
    with pytest.raises(rec.TokenRecuperacionInvalido):
        rec.consumir_token(db, token)


def test_token_inexistente_se_rechaza():
    db = _db()
    with pytest.raises(rec.TokenRecuperacionInvalido):
        rec.consumir_token(db, "no-existe")


def test_pedir_otro_enlace_invalida_el_anterior():
    """Si pediste el enlace tres veces sirve el último, no los tres."""
    db = _db()
    u = _usuario(db)
    viejo = rec.emitir_token(db, u)
    nuevo = rec.emitir_token(db, u)
    with pytest.raises(rec.TokenRecuperacionInvalido):
        rec.consumir_token(db, viejo)
    assert rec.consumir_token(db, nuevo).id == u.id


def test_revocar_la_cuenta_invalida_un_token_ya_emitido():
    """Pidió el enlace y lo desactivaron antes de abrirlo."""
    db = _db()
    u = _usuario(db)
    token = rec.emitir_token(db, u)
    u.activo = False
    db.commit()
    with pytest.raises(rec.TokenRecuperacionInvalido):
        rec.consumir_token(db, token)


def test_el_token_de_uno_no_sirve_para_otro():
    db = _db()
    uno, dos = _usuario(db), _usuario(db)
    token = rec.emitir_token(db, uno)
    assert rec.consumir_token(db, token).id == uno.id != dos.id


# ── Contraseña ───────────────────────────────────────────────────────────────

def test_password_corta_se_rechaza():
    from app.core.exceptions import AcreditaError
    with pytest.raises(AcreditaError):
        rec.exigir_password_aceptable("corta")


def test_password_de_largo_minimo_pasa():
    rec.exigir_password_aceptable("a" * rec.LARGO_MINIMO)
