"""
Smoke test de la vista por documento del portal del contratista, contra SQLite.

Lo que importa verificar: que un mismo documento fisico exigido por varios
mandantes sea UNA fila con N estados (es lo que hace visible la reutilizacion),
y que los de alcance SERVICIO nunca se unifiquen entre mandantes.

Correr:  python tests/test_vista_documental.py
"""
import os
import sys
import tempfile
from datetime import date

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ.setdefault("DATABASE_URL", "postgresql://x:x@localhost/x")
os.environ.setdefault("JWT_SECRET", "test")
os.environ["FILE_STORAGE"] = "local"
os.environ["LOCAL_STORAGE_PATH"] = tempfile.mkdtemp(prefix="acredita_vista_")

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

import app.models  # noqa: F401
from app.models.base import Base
from app.models.contratista import ContratistaMandante, EmpresaContratista
from app.models.expediente import Acreditacion, Entrega, Expediente
from app.models.mandante import Mandante
from app.models.pilar import Pilar, RequisitoDocumental, Subpilar
from app.models.servicio import PerfilRequisitos, PerfilRequisitoConfig, Servicio
from app.models.usuario import Usuario
from app.api import documentos as api_doc
from app.domain import acreditacion_service
from app.domain.estados import EstadoAcreditacion, EstadoDocumento, EstadoServicio

HOY = date.today()


def _requisito(db, sub, codigo, alcance="ENTIDAD", entidad="EMPRESA"):
    r = RequisitoDocumental(subpilar_id=sub.id, codigo=codigo, nombre=codigo,
                            entidad_tipo=entidad, alcance=alcance)
    db.add(r); db.flush()
    return r


def _perfil_con(db, mandante, nombre, requisitos):
    p = PerfilRequisitos(mandante_id=mandante.id, nombre=nombre); db.add(p); db.flush()
    for r in requisitos:
        db.add(PerfilRequisitoConfig(perfil_id=p.id, requisito_documental_id=r.id,
                                     es_obligatorio=True, vigencia_max_dias=365))
    db.flush()
    return p


def run():
    eng = create_engine("sqlite://")
    Base.metadata.create_all(eng)
    db = Session(eng)

    c = EmpresaContratista(rut="76.9-9", razon_social="ABC")
    codelco = Mandante(razon_social="Codelco", rut="1-9", slug="codelco", plan="Pro")
    falabella = Mandante(razon_social="Falabella", rut="2-7", slug="falabella", plan="Pro")
    db.add_all([c, codelco, falabella]); db.flush()
    u = Usuario(email="ct@abc.cl", password_hash="x", rol="contratista_admin",
                nombre="CT", contratista_id=c.id, activo=True)
    db.add(u); db.flush()

    pilar = Pilar(codigo="LEGAL", nombre="Legal", orden=0); db.add(pilar); db.flush()
    sub = Subpilar(pilar_id=pilar.id, codigo="LAB", nombre="Lab", orden=0); db.add(sub); db.flush()
    f30 = _requisito(db, sub, "F30")                                  # ENTIDAD -> se unifica
    miper = _requisito(db, sub, "MIPER", alcance="SERVICIO")           # SERVICIO -> no se unifica

    # Ambos mandantes exigen F30 y MIPER, cada uno con su servicio activo.
    for m, faena in ((codelco, "Obra Norte"), (falabella, "Obra Sur")):
        rel = ContratistaMandante(contratista_id=c.id, mandante_id=m.id,
                                  estado_acreditacion=EstadoAcreditacion.PENDIENTE)
        db.add(rel); db.flush()
        perfil = _perfil_con(db, m, f"Perfil {m.slug}", [f30, miper])
        db.add(Servicio(contratista_mandante_id=rel.id, perfil_requisitos_id=perfil.id,
                        nombre=faena, fecha_inicio=HOY, estado=EstadoServicio.ACTIVO))
    db.commit()

    # El contratista subio su F30 una vez; Codelco lo aprobo, Falabella lo tiene
    # en revision. Mismo expediente, misma entrega, dos acreditaciones.
    exp = Expediente(requisito_id=f30.id, empresa_id=c.id); db.add(exp); db.flush()
    entrega = Entrega(expediente_id=exp.id, numero_version=1); db.add(entrega); db.flush()
    db.add(Acreditacion(mandante_id=codelco.id, expediente_id=exp.id, entrega_id=entrega.id,
                        numero_version=1, estado=EstadoDocumento.APROBADO))
    db.add(Acreditacion(mandante_id=falabella.id, expediente_id=exp.id, entrega_id=entrega.id,
                        numero_version=1, estado=EstadoDocumento.ENVIADO))
    db.commit()

    docs = acreditacion_service.vista_documental(db, c.id)

    # 1. El F30 es UNA fila con los dos mandantes -- no dos filas.
    filas_f30 = [d for d in docs if d.requisito_codigo == "F30"]
    assert len(filas_f30) == 1, f"el F30 debio ser una sola fila, fueron {len(filas_f30)}"
    f = filas_f30[0]
    assert len(f.mandantes) == 2, f"el F30 debio traer 2 mandantes, trajo {len(f.mandantes)}"
    print("PASS: documento ENTIDAD -> una fila para todos los mandantes")

    # 2. Cada mandante conserva SU estado sobre el mismo documento.
    por_nombre = {m.mandante_razon_social: m for m in f.mandantes}
    assert por_nombre["Codelco"].estado == EstadoDocumento.APROBADO
    assert por_nombre["Falabella"].estado == EstadoDocumento.ENVIADO
    assert por_nombre["Codelco"].documento_id != por_nombre["Falabella"].documento_id, \
        "cada mandante revisa su propia acreditacion"
    print("PASS: cada mandante conserva su estado y su acreditacion")

    # 3. Los mandantes vienen ordenados (la UI no debe barajarlos entre cargas).
    assert [m.mandante_razon_social for m in f.mandantes] == ["Codelco", "Falabella"]
    print("PASS: mandantes ordenados de forma estable")

    # 4. El MIPER es de alcance SERVICIO: una fila POR servicio, nunca unificado.
    filas_miper = [d for d in docs if d.requisito_codigo == "MIPER"]
    assert len(filas_miper) == 2, f"el MIPER debio dar 2 filas (una por faena), dio {len(filas_miper)}"
    assert all(len(d.mandantes) == 1 for d in filas_miper), \
        "un documento por servicio pertenece a un solo mandante"
    assert {d.servicio_nombre for d in filas_miper} == {"Obra Norte", "Obra Sur"}
    print("PASS: alcance SERVICIO -> una fila por faena, sin unificar")

    # 5. Un requisito exigido y no subido aparece igual, como brecha.
    assert all(m.estado is None for m in filas_miper[0].mandantes), \
        "lo exigido sin subir debe aparecer con estado None"
    print("PASS: requisito exigido sin subir aparece como brecha")

    # 6. Capa API: deriva el contratista del token, no del path.
    resp = api_doc.mis_documentos(db=db, usuario=u)
    assert len(resp) == len(docs)
    print("PASS: capa API deriva el contratista del token")

    ajeno = Usuario(email="x@y.cl", password_hash="x", rol="contratista_admin",
                    nombre="X", contratista_id=None, activo=True)
    db.add(ajeno); db.flush()
    try:
        api_doc.mis_documentos(db=db, usuario=ajeno)
        raise AssertionError("un usuario sin contratista no debio obtener documentos")
    except HTTPException as e:
        assert e.status_code == 400
    print("PASS: usuario sin contratista -> 400")

    # ── Mandantes anclados a versiones DISTINTAS ─────────────────────────────
    # Codelco aprobo la v1 y sigue vigente; el contratista sube una v2 y
    # Falabella la observa. El pin es explicito: subir la v2 NO debe mover a
    # Codelco, porque eso lo desacreditaria mientras su v1 sigue vigente.
    v2 = Entrega(expediente_id=exp.id, numero_version=2); db.add(v2); db.flush()
    acred_fal = (db.query(Acreditacion)
                 .filter_by(expediente_id=exp.id, mandante_id=falabella.id).first())
    acred_fal.entrega_id = v2.id
    acred_fal.numero_version = 2
    acred_fal.estado = EstadoDocumento.OBSERVADO
    acred_fal.mensaje_brecha = "Ilegible"
    db.commit()

    f = next(d for d in acreditacion_service.vista_documental(db, c.id)
             if d.requisito_codigo == "F30")
    por_nombre = {m.mandante_razon_social: m for m in f.mandantes}

    assert len(f.mandantes) == 2, "sigue siendo UNA fila aunque miren versiones distintas"
    assert por_nombre["Codelco"].numero_version == 1, "Codelco no debe moverse de su v1"
    assert por_nombre["Codelco"].estado == EstadoDocumento.APROBADO, \
        "que otro mandante rechace la v2 no puede desacreditar al que aprobo la v1"
    assert por_nombre["Falabella"].numero_version == 2
    assert por_nombre["Falabella"].estado == EstadoDocumento.OBSERVADO
    assert por_nombre["Falabella"].mensaje_brecha == "Ilegible"
    print("PASS: cada mandante conserva SU version (v1 aprobada vs v2 observada)")

    # Y el caso mas confuso de todos: AMBOS aprueban, pero versiones distintas.
    # Los dos badges dicen "aprobado" y solo el numero de version explica por que
    # tienen vigencias distintas.
    acred_fal.estado = EstadoDocumento.APROBADO
    acred_fal.mensaje_brecha = None
    db.commit()

    f = next(d for d in acreditacion_service.vista_documental(db, c.id)
             if d.requisito_codigo == "F30")
    por_nombre = {m.mandante_razon_social: m for m in f.mandantes}
    assert all(m.estado == EstadoDocumento.APROBADO for m in f.mandantes)
    assert por_nombre["Codelco"].numero_version == 1
    assert por_nombre["Falabella"].numero_version == 2
    assert len({m.numero_version for m in f.mandantes}) == 2, \
        "ambos aprobados pero en versiones distintas: la UI debe poder distinguirlas"
    print("PASS: ambos aprobados en versiones distintas -> versiones distinguibles")

    print("TODOS LOS TESTS DE VISTA DOCUMENTAL PASARON")


if __name__ == "__main__":
    run()
