"""
Smoke test de integración del modelo Fase 1 (Expediente/Entrega/Archivo/
Acreditacion). Corre contra SQLite en memoria + storage local temporal, sin
DB externa ni email-validator. Ejercita el flujo real del dominio.

Correr:  python tests/test_expediente_flujo.py   (o vía pytest)
"""
import os
import sys
import tempfile
from datetime import date

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ.setdefault("DATABASE_URL", "postgresql://x:x@localhost/x")
os.environ.setdefault("JWT_SECRET", "test")
os.environ["FILE_STORAGE"] = "local"
os.environ["LOCAL_STORAGE_PATH"] = tempfile.mkdtemp(prefix="acredita_test_")

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

import app.models  # noqa: F401 — registra todos los modelos
from app.models.base import Base
from app.models.contratista import ContratistaMandante, EmpresaContratista
from app.models.expediente import Acreditacion, Archivo, Entrega, Expediente
from app.models.mandante import Mandante
from app.models.pilar import Pilar, RequisitoDocumental, Subpilar
from app.models.servicio import PerfilRequisitoConfig, PerfilRequisitos, Servicio
from app.models.usuario import Usuario
from app.api import documentos as api_doc
from app.domain import acreditacion_service, documento_service
from app.domain.archivo_service import ArchivoEntrada
from app.domain.estados import EstadoAcreditacion, EstadoDocumento


def _seed(db):
    m = Mandante(razon_social="Codelco", rut="1-9", slug="codelco", plan="Pro")
    c = EmpresaContratista(rut="76.111.111-1", razon_social="Constructora ABC")
    db.add_all([m, c]); db.flush()
    rel = ContratistaMandante(contratista_id=c.id, mandante_id=m.id, estado_acreditacion=EstadoAcreditacion.PENDIENTE)
    u = Usuario(email="rev@x.cl", nombre="Rev", password_hash="", rol="mandante_admin", mandante_id=m.id)
    pilar = Pilar(codigo="LEGAL", nombre="Legal/Laboral", orden=0)
    db.add_all([rel, u, pilar]); db.flush()
    sub = Subpilar(pilar_id=pilar.id, codigo="LAB", nombre="Laboral", orden=0)
    db.add(sub); db.flush()
    req = RequisitoDocumental(subpilar_id=sub.id, codigo="F30", nombre="F30",
                              entidad_tipo="EMPRESA", alcance="ENTIDAD", max_archivos=1)
    perfil = PerfilRequisitos(mandante_id=m.id, nombre="General")
    db.add_all([req, perfil]); db.flush()
    cfg = PerfilRequisitoConfig(perfil_id=perfil.id, requisito_documental_id=req.id,
                                es_obligatorio=True, vigencia_max_dias=90)
    serv = Servicio(contratista_mandante_id=rel.id, perfil_requisitos_id=perfil.id,
                    nombre="Obra 1", fecha_inicio=date(2026, 1, 1), estado="ACTIVO")
    db.add_all([cfg, serv]); db.flush()
    return m, c, u, req


def _file(contenido=b"%PDF-1.4 f30 original"):
    return [ArchivoEntrada(contenido=contenido, nombre_original="f30.pdf", mime_type="application/pdf")]


def run():
    eng = create_engine("sqlite://")
    Base.metadata.create_all(eng)
    db = Session(eng)
    m, c, u, req = _seed(db)

    # 1. Subida crea Expediente + Entrega + Archivo + Acreditacion (ENVIADO, v1)
    r = documento_service.subir_entrega(db, req.id, m.id, c.id, None, None, _file(), u.id)
    assert db.query(Expediente).count() == 1, "debio crear 1 expediente"
    assert db.query(Entrega).count() == 1, "debio crear 1 entrega"
    assert db.query(Archivo).count() == 1, "debio crear 1 archivo"
    assert db.query(Acreditacion).count() == 1, "debio crear 1 acreditacion"
    acred = db.get(Acreditacion, r.documento_id)
    assert acred.estado == EstadoDocumento.ENVIADO and acred.numero_version == 1
    exp = db.query(Expediente).first()
    assert exp.empresa_id == c.id and exp.servicio_id is None, "expediente sin mandante, ENTIDAD sin servicio"
    print("PASS 1: subida -> Expediente/Entrega/Archivo/Acreditacion, ENVIADO v1")

    # 2. Revision manual: aprobar con vigencia -> APROBADO, vigencia en la ENTREGA
    documento_service.revisar_documento(db, acred.id, u.id, aprobar=True, fecha_vigencia_hasta=date(2027, 1, 1))
    db.refresh(acred)
    assert acred.estado == EstadoDocumento.APROBADO
    assert acred.entrega.fecha_vigencia_hasta == date(2027, 1, 1), "la vigencia vive en la Entrega"
    print("PASS 2: revision -> APROBADO, vigencia escrita en la Entrega")

    # 3. De-dup: subir el MISMO archivo NO crea version nueva
    documento_service.subir_entrega(db, req.id, m.id, c.id, None, None, _file(), u.id)
    assert db.query(Entrega).count() == 1, "de-dup fallo: creo version con archivo identico"
    print("PASS 3: de-dup -> archivo identico no crea version nueva")

    # 4. Archivo DISTINTO crea version nueva (v2)
    db.refresh(acred)
    documento_service.revisar_documento(db, acred.id, u.id, aprobar=True)  # salir de ENVIADO
    documento_service.subir_entrega(db, req.id, m.id, c.id, None, None, _file(b"%PDF-1.4 renovado"), u.id)
    assert db.query(Entrega).count() == 2, "archivo distinto debio crear v2"
    db.refresh(acred)
    assert acred.numero_version == 2 and acred.estado == EstadoDocumento.ENVIADO
    print("PASS 4: archivo distinto -> v2, acreditacion re-pineada")

    # 5. Evaluacion de la relacion ve el F30 (via Acreditacion+Expediente)
    ev = acreditacion_service.evaluar_relacion(db, c.id, m.id)
    assert ev.tiene_servicios_activos
    assert "F30" in [i.requisito_codigo for i in ev.items_empresa]
    item = next(i for i in ev.items_empresa if i.requisito_codigo == "F30")
    assert item.documento_id == acred.id and item.estado == EstadoDocumento.ENVIADO
    print("PASS 5: evaluar_relacion ve F30 con estado y documento_id correctos")

    # 6. Aprobar la v2 -> el agregado (recalculado en la revision) pasa a ACREDITADA
    #    (F30 es la unica exigencia; el agregado solo se recalcula en eventos de
    #    revision, no al subir — igual que el modelo anterior).
    documento_service.revisar_documento(db, acred.id, u.id, aprobar=True)
    est = acreditacion_service.obtener_estado_acreditacion(db, c.id, m.id)
    assert est.estado_global == EstadoAcreditacion.ACREDITADA, f"esperaba ACREDITADA, vino {est.estado_global}"
    print("PASS 6: aprobada la v2 -> relacion ACREDITADA")

    # 7. Capa API: obtener_documento / historial / pendientes / url-descarga
    resp = api_doc.obtener_documento(documento_id=acred.id, db=db, usuario=u)
    assert resp.id == acred.id and resp.estado == EstadoDocumento.APROBADO
    assert resp.version_vigente is not None and resp.version_vigente.numero_version == 2
    hist = api_doc.historial_documento(documento_id=acred.id, db=db, usuario=u)
    assert len(hist.versiones) == 2 and len(hist.eventos) >= 1
    pend = api_doc.pendientes_revision(db=db, usuario=u)
    assert all(p.documento_id != acred.id for p in pend), "aprobada no debe seguir pendiente"
    url = api_doc.obtener_url_descarga(documento_id=acred.id, db=db, usuario=u)
    assert url.url
    print("PASS 7: capa API (obtener/historial/pendientes/url) OK")

    print("TODOS LOS SMOKE TESTS DE FLUJO PASARON")


if __name__ == "__main__":
    run()

# ── Puente para pytest ────────────────────────────────────────────────────────
# Estos archivos nacieron como scripts (`python tests/test_x.py`) y su punto de
# entrada se llama run(), que pytest NO recolecta porque no empieza con "test_".
# Resultado: la suite reportaba verde corriendo 5 de los ~30 tests que existen.
# El envoltorio los expone sin tocar la lógica, y el modo script sigue andando.
def test_expediente_flujo():
    run()
