"""
Vencimiento y renovación automática de documentos.

Es la mitad del ciclo de vida que nadie había probado nunca. Importa porque
falla en silencio: si el cron no marca un documento vencido, el contratista
sigue figurando acreditado y nadie se entera hasta que alguien entra a una faena
sin estar habilitado. A diferencia de un bug de pantalla, este no lo reporta
ningún usuario — aparece solo, con el tiempo.

`procesar_vencimientos` acepta `hoy` inyectable, así que todo esto se prueba sin
esperar a mañana y sin tocar la base real.

Corre contra SQLite en memoria.
"""
import os
import sys
import uuid
from datetime import date, timedelta

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ.setdefault("DATABASE_URL", "postgresql://x:x@localhost/x")
os.environ.setdefault("JWT_SECRET", "test")

from sqlalchemy.orm import Session

import app.models  # noqa: F401 — registra los modelos
from app.models.base import Base
from app.models.contratista import ContratistaMandante, EmpresaContratista
from app.models.expediente import Acreditacion, Entrega, Expediente
from app.models.mandante import Mandante
from app.models.pilar import Pilar, RequisitoDocumental, Subpilar
from app.domain.estados import EstadoDocumento
from app.domain import vencimiento_service

from tests._db import engine_sqlite

HOY = date(2026, 8, 12)
AYER = HOY - timedelta(days=1)
MANANA = HOY + timedelta(days=1)


def _mundo(db, *, vigencia, sin_vencimiento=False, estado=EstadoDocumento.APROBADO):
    """Un expediente con una entrega aprobada. Devuelve (acreditacion, expediente)."""
    m = Mandante(id=uuid.uuid4(), razon_social="M", rut="1-9", slug=f"m{uuid.uuid4().hex[:6]}", activo=True)
    e = EmpresaContratista(id=uuid.uuid4(), razon_social="C", rut=f"{uuid.uuid4().int % 10**8}-1")
    db.add_all([m, e])
    db.add(ContratistaMandante(id=uuid.uuid4(), contratista_id=e.id, mandante_id=m.id))

    pilar = Pilar(id=uuid.uuid4(), codigo=f"P{uuid.uuid4().hex[:4]}", nombre="P", orden=1)
    sub = Subpilar(id=uuid.uuid4(), pilar_id=pilar.id, codigo=f"S{uuid.uuid4().hex[:4]}", nombre="S", orden=1)
    req = RequisitoDocumental(
        id=uuid.uuid4(), subpilar_id=sub.id, codigo=f"R{uuid.uuid4().hex[:4]}",
        nombre="Requisito", entidad_tipo="EMPRESA", alcance="ENTIDAD",
        sin_vencimiento=sin_vencimiento,
    )
    db.add_all([pilar, sub, req])

    exp = Expediente(id=uuid.uuid4(), requisito_id=req.id, empresa_id=e.id)
    db.add(exp)
    entrega = Entrega(id=uuid.uuid4(), expediente_id=exp.id, numero_version=1,
                      fecha_vigencia_hasta=vigencia)
    db.add(entrega)
    acred = Acreditacion(
        id=uuid.uuid4(), expediente_id=exp.id, mandante_id=m.id,
        entrega_id=entrega.id, numero_version=1, estado=estado,
    )
    db.add(acred)
    db.commit()
    return acred, exp


def _db():
    engine = engine_sqlite(connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    return Session(engine)


# ── Lo que tiene que pasar ───────────────────────────────────────────────────

def test_documento_con_vigencia_pasada_se_marca_vencido():
    """El caso que importa: si esto no ocurre, alguien figura acreditado sin estarlo."""
    db = _db()
    acred, _ = _mundo(db, vigencia=AYER)
    r = vencimiento_service.procesar_vencimientos(db, hoy=HOY)
    db.commit()
    assert r["vencidas"] == 1
    assert acred.estado == EstadoDocumento.VENCIDO


def test_documento_vigente_no_se_toca():
    db = _db()
    acred, _ = _mundo(db, vigencia=MANANA)
    r = vencimiento_service.procesar_vencimientos(db, hoy=HOY)
    assert r["vencidas"] == 0 and r["renovadas"] == 0
    assert acred.estado == EstadoDocumento.APROBADO


def test_vence_justo_hoy_todavia_sirve():
    """El borde: `< hoy`, no `<= hoy`. Un certificado vigente hasta hoy vale hoy."""
    db = _db()
    acred, _ = _mundo(db, vigencia=HOY)
    vencimiento_service.procesar_vencimientos(db, hoy=HOY)
    assert acred.estado == EstadoDocumento.APROBADO


def test_requisito_sin_vencimiento_nunca_vence():
    """Una escritura de constitución no caduca; marcarla vencida sería ruido puro."""
    db = _db()
    acred, _ = _mundo(db, vigencia=AYER, sin_vencimiento=True)
    r = vencimiento_service.procesar_vencimientos(db, hoy=HOY)
    assert r["vencidas"] == 0
    assert acred.estado == EstadoDocumento.APROBADO


# ── Renovación automática ────────────────────────────────────────────────────

def test_si_hay_una_version_posterior_vigente_se_reancla_en_vez_de_vencer():
    """
    El contratista ya subió la renovación y el mandante todavía no la revisó. La
    acreditación se re-ancla a esa versión y vuelve a la cola, en vez de marcarse
    vencida: bloquear a alguien que ya cumplió su parte sería castigar la demora
    del revisor.
    """
    db = _db()
    acred, exp = _mundo(db, vigencia=AYER)
    nueva = Entrega(id=uuid.uuid4(), expediente_id=exp.id, numero_version=2,
                    fecha_vigencia_hasta=HOY + timedelta(days=365))
    db.add(nueva)
    db.commit()

    r = vencimiento_service.procesar_vencimientos(db, hoy=HOY)
    db.commit()
    assert r["renovadas"] == 1 and r["vencidas"] == 0
    assert acred.estado == EstadoDocumento.ENVIADO
    assert acred.entrega_id == nueva.id
    assert acred.numero_version == 2


def test_una_version_posterior_tambien_vencida_no_sirve_de_sucesora():
    """Subir un documento igual de viejo no renueva nada."""
    db = _db()
    acred, exp = _mundo(db, vigencia=AYER)
    db.add(Entrega(id=uuid.uuid4(), expediente_id=exp.id, numero_version=2,
                   fecha_vigencia_hasta=AYER))
    db.commit()

    r = vencimiento_service.procesar_vencimientos(db, hoy=HOY)
    db.commit()
    assert r["vencidas"] == 1 and r["renovadas"] == 0
    assert acred.estado == EstadoDocumento.VENCIDO


def test_no_vuelve_a_vencer_lo_ya_vencido():
    """Corre todos los días: contar dos veces inflaría cualquier métrica."""
    db = _db()
    acred, _ = _mundo(db, vigencia=AYER)
    vencimiento_service.procesar_vencimientos(db, hoy=HOY)
    db.commit()
    r2 = vencimiento_service.procesar_vencimientos(db, hoy=HOY)
    assert r2["vencidas"] == 0
    assert acred.estado == EstadoDocumento.VENCIDO
