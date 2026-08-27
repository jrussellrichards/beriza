"""
Smoke test de la reconciliación de vencimientos (Fase 2), contra SQLite.

Cubre los tres casos: vence sin sucesora -> VENCIDO; con sucesora vigente ->
auto-repin a ENVIADO; requisito sin_vencimiento -> ignorado.

Correr:  python tests/test_vencimiento.py
"""
import os
import sys
import tempfile
from datetime import date, timedelta

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ.setdefault("DATABASE_URL", "postgresql://x:x@localhost/x")
os.environ.setdefault("JWT_SECRET", "test")
os.environ["FILE_STORAGE"] = "local"
os.environ["LOCAL_STORAGE_PATH"] = tempfile.mkdtemp(prefix="acredita_venc_")

from sqlalchemy.orm import Session

import app.models  # noqa: F401
from app.models.base import Base
from app.models.contratista import ContratistaMandante, EmpresaContratista
from app.models.expediente import Acreditacion, Archivo, Entrega, Expediente
from app.models.mandante import Mandante
from app.models.pilar import Pilar, RequisitoDocumental, Subpilar
from app.domain import vencimiento_service
from app.domain.estados import EstadoAcreditacion, EstadoDocumento

from tests._db import engine_sqlite

HOY = date(2026, 7, 24)
AYER = HOY - timedelta(days=1)
FUTURO = HOY + timedelta(days=180)


def _requisito(db, sub, codigo, sin_venc):
    r = RequisitoDocumental(subpilar_id=sub.id, codigo=codigo, nombre=codigo,
                            entidad_tipo="EMPRESA", alcance="ENTIDAD", sin_vencimiento=sin_venc)
    db.add(r); db.flush()
    return r


def _expediente_aprobado(db, req, empresa, mandante, vig_vigente, con_sucesora=False):
    exp = Expediente(requisito_id=req.id, empresa_id=empresa.id)
    db.add(exp); db.flush()
    e1 = Entrega(expediente_id=exp.id, numero_version=1, fecha_vigencia_hasta=vig_vigente)
    db.add(e1); db.flush()
    entrega_pin = e1
    if con_sucesora:
        e2 = Entrega(expediente_id=exp.id, numero_version=2, fecha_vigencia_hasta=FUTURO)
        db.add(e2); db.flush()
    acred = Acreditacion(mandante_id=mandante.id, expediente_id=exp.id, entrega_id=entrega_pin.id,
                         numero_version=1, estado=EstadoDocumento.APROBADO)
    db.add(acred); db.flush()
    return acred


def run():
    eng = engine_sqlite()
    Base.metadata.create_all(eng)
    db = Session(eng)

    m = Mandante(razon_social="Codelco", rut="1-9", slug="codelco", plan="Pro")
    c = EmpresaContratista(rut="76.1-1", razon_social="ABC")
    db.add_all([m, c]); db.flush()
    db.add(ContratistaMandante(contratista_id=c.id, mandante_id=m.id,
                               estado_acreditacion=EstadoAcreditacion.ACREDITADA))
    pilar = Pilar(codigo="LEGAL", nombre="Legal", orden=0); db.add(pilar); db.flush()
    sub = Subpilar(pilar_id=pilar.id, codigo="LAB", nombre="Lab", orden=0); db.add(sub); db.flush()

    # Requisitos distintos: solo hay UN expediente por (requisito, empresa) para
    # alcance ENTIDAD (constraint real), así que cada caso usa su propio requisito.
    req_venc = _requisito(db, sub, "F30", sin_venc=False)
    req_sin = _requisito(db, sub, "CONSTITUCION", sin_venc=True)
    req_repin = _requisito(db, sub, "F30_1", sin_venc=False)
    db.commit()

    a_vence = _expediente_aprobado(db, req_venc, c, m, AYER, con_sucesora=False)  # -> VENCIDO
    a_ignora = _expediente_aprobado(db, req_sin, c, m, AYER, con_sucesora=False)  # sin_venc -> ignora
    a_repin = _expediente_aprobado(db, req_repin, c, m, AYER, con_sucesora=True)  # -> ENVIADO (v2)
    db.commit()

    res = vencimiento_service.procesar_vencimientos(db, hoy=HOY)
    for a in (a_vence, a_ignora, a_repin):
        db.refresh(a)

    assert res == {"renovadas": 1, "vencidas": 1}, f"resumen inesperado: {res}"
    assert a_vence.estado == EstadoDocumento.VENCIDO, "sin sucesora debio quedar VENCIDO"
    assert a_ignora.estado == EstadoDocumento.APROBADO, "sin_vencimiento no debe tocarse"
    assert a_repin.estado == EstadoDocumento.ENVIADO and a_repin.numero_version == 2, \
        "con sucesora debio re-anclar a v2 y quedar ENVIADO"
    print("PASS: vence -> VENCIDO")
    print("PASS: sin_vencimiento -> ignorado")
    print("PASS: sucesora vigente -> auto-repin a v2 (ENVIADO)")

    # Idempotencia: correr de nuevo no cambia nada (ya no hay APROBADOs vencidos)
    res2 = vencimiento_service.procesar_vencimientos(db, hoy=HOY)
    assert res2 == {"renovadas": 0, "vencidas": 0}, f"segunda corrida debio ser no-op: {res2}"
    print("PASS: idempotente (segunda corrida no-op)")

    # Alertas: un doc aprobado que vence en EXACTAMENTE 30 días aparece en el digest
    req_alerta = _requisito(db, sub, "RIOHS", sin_venc=False)
    _expediente_aprobado(db, req_alerta, c, m, HOY + timedelta(days=30), con_sucesora=False)
    db.commit()
    alertas = vencimiento_service.alertas_de_vencimiento(db, hoy=HOY)
    assert c.id in alertas, "el contratista debio tener alertas"
    assert any(x["requisito"] == "RIOHS" and x["dias"] == 30 for x in alertas[c.id]), \
        "el doc que vence en 30 días debio estar en el digest"
    print("PASS: alerta a 30 días en el digest del contratista")

    print("TODOS LOS TESTS DE VENCIMIENTO PASARON")


if __name__ == "__main__":
    run()

# ── Puente para pytest ────────────────────────────────────────────────────────
# Estos archivos nacieron como scripts (`python tests/test_x.py`) y su punto de
# entrada se llama run(), que pytest NO recolecta porque no empieza con "test_".
# Resultado: la suite reportaba verde corriendo 5 de los ~30 tests que existen.
# El envoltorio los expone sin tocar la lógica, y el modo script sigue andando.
def test_vencimiento():
    run()
