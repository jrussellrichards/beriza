"""
Smoke test de la reutilización documental entre mandantes (Fase 2), contra SQLite.

Cubre: un mandante nuevo exige requisitos ENTIDAD que el contratista ya tiene
resueltos -> se crean acreditaciones reutilizando la entrega vigente.
  - requisito genérico -> ENVIADO apuntando a la entrega vigente
  - requisito sensible -> PENDIENTE_AUTORIZACION, sin compartir la entrega
  - autorizar_compartir -> el sensible pasa a ENVIADO y queda anclado
  - idempotencia -> reconciliar de nuevo no duplica acreditaciones
  - alcance SERVICIO -> nunca se reutiliza entre mandantes

Correr:  python tests/test_reutilizacion.py
"""
import os
import sys
import tempfile
from datetime import date, timedelta

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ.setdefault("DATABASE_URL", "postgresql://x:x@localhost/x")
os.environ.setdefault("JWT_SECRET", "test")
os.environ["FILE_STORAGE"] = "local"
os.environ["LOCAL_STORAGE_PATH"] = tempfile.mkdtemp(prefix="acredita_reuso_")

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
from app.domain import reutilizacion_service
from app.domain.estados import EstadoAcreditacion, EstadoDocumento, EstadoServicio

HOY = date(2026, 7, 24)
FUTURO = HOY + timedelta(days=180)


def _requisito(db, sub, codigo, alcance="ENTIDAD", sensible=False):
    r = RequisitoDocumental(subpilar_id=sub.id, codigo=codigo, nombre=codigo,
                            entidad_tipo="EMPRESA", alcance=alcance, sensible=sensible)
    db.add(r); db.flush()
    return r


def _expediente_vigente(db, req, empresa):
    exp = Expediente(requisito_id=req.id, empresa_id=empresa.id)
    db.add(exp); db.flush()
    e = Entrega(expediente_id=exp.id, numero_version=1, fecha_vigencia_hasta=FUTURO)
    db.add(e); db.flush()
    return exp


def _acred_de(db, exp, mandante):
    return (db.query(Acreditacion)
            .filter_by(expediente_id=exp.id, mandante_id=mandante.id, eliminado_en=None)
            .first())


def run():
    eng = create_engine("sqlite://")
    Base.metadata.create_all(eng)
    db = Session(eng)

    m = Mandante(razon_social="Falabella", rut="2-7", slug="falabella", plan="Pro")
    c = EmpresaContratista(rut="76.2-2", razon_social="ABC")
    db.add_all([m, c]); db.flush()
    db.add(Usuario(email="ct@abc.cl", password_hash="x", rol="contratista_admin",
                   nombre="CT", contratista_id=c.id, activo=True))
    rel = ContratistaMandante(contratista_id=c.id, mandante_id=m.id,
                              estado_acreditacion=EstadoAcreditacion.PENDIENTE)
    db.add(rel); db.flush()

    pilar = Pilar(codigo="LEGAL", nombre="Legal", orden=0); db.add(pilar); db.flush()
    sub = Subpilar(pilar_id=pilar.id, codigo="LAB", nombre="Lab", orden=0); db.add(sub); db.flush()

    req_gen = _requisito(db, sub, "F30", sensible=False)                 # genérico -> ENVIADO
    req_sens = _requisito(db, sub, "CARPETA_TRIB", sensible=True)        # sensible -> PENDIENTE
    req_srv = _requisito(db, sub, "MIPER", alcance="SERVICIO")           # SERVICIO -> ignorado

    # El contratista ya tiene resueltos los dos ENTIDAD (no el de servicio).
    exp_gen = _expediente_vigente(db, req_gen, c)
    exp_sens = _expediente_vigente(db, req_sens, c)

    # Perfil del mandante nuevo que exige los tres requisitos + un servicio activo.
    perfil = PerfilRequisitos(mandante_id=m.id, nombre="Obras"); db.add(perfil); db.flush()
    for r in (req_gen, req_sens, req_srv):
        db.add(PerfilRequisitoConfig(perfil_id=perfil.id, requisito_documental_id=r.id,
                                     es_obligatorio=True, vigencia_max_dias=365))
    db.add(Servicio(contratista_mandante_id=rel.id, perfil_requisitos_id=perfil.id,
                    nombre="Faena 1", fecha_inicio=HOY, estado=EstadoServicio.ACTIVO))
    db.commit()

    creadas = reutilizacion_service.reconciliar_reutilizacion(db, c.id, m.id)
    assert len(creadas) == 2, f"debieron crearse 2 acreditaciones (genérico + sensible), fueron {len(creadas)}"

    a_gen = _acred_de(db, exp_gen, m)
    a_sens = _acred_de(db, exp_sens, m)
    assert a_gen.estado == EstadoDocumento.ENVIADO, "el genérico debe quedar ENVIADO"
    assert a_gen.entrega_id is not None, "el genérico debe quedar anclado a la entrega vigente"
    print("PASS: requisito genérico -> ENVIADO anclado a la entrega vigente")

    assert a_sens.estado == EstadoDocumento.PENDIENTE_AUTORIZACION, "el sensible debe quedar PENDIENTE"
    assert a_sens.entrega_id is None, "el sensible NO debe compartir la entrega antes de autorizar"
    print("PASS: requisito sensible -> PENDIENTE_AUTORIZACION sin compartir la entrega")

    # El de alcance SERVICIO no genera acreditación reutilizada.
    assert db.query(Acreditacion).filter_by(mandante_id=m.id).count() == 2, \
        "el requisito de alcance SERVICIO no debe reutilizarse"
    print("PASS: alcance SERVICIO -> no se reutiliza entre mandantes")

    # Idempotencia: reconciliar de nuevo no duplica.
    creadas2 = reutilizacion_service.reconciliar_reutilizacion(db, c.id, m.id)
    assert creadas2 == [], f"la segunda corrida no debe crear nada: {creadas2}"
    assert db.query(Acreditacion).filter_by(mandante_id=m.id).count() == 2, "no debe haber duplicados"
    print("PASS: idempotente (segunda reconciliación no duplica)")

    # Bandeja de pendientes y autorización explícita.
    pendientes = reutilizacion_service.acreditaciones_pendientes_autorizacion(db, c.id)
    assert [p.id for p in pendientes] == [a_sens.id], "la bandeja debe traer solo el sensible pendiente"
    print("PASS: bandeja de pendientes lista el sensible")

    usuario = db.query(Usuario).filter_by(contratista_id=c.id).first()
    reutilizacion_service.autorizar_compartir(db, a_sens.id, usuario.id)
    db.refresh(a_sens)
    assert a_sens.estado == EstadoDocumento.ENVIADO, "tras autorizar debe pasar a ENVIADO"
    assert a_sens.entrega_id is not None, "tras autorizar debe quedar anclado a la entrega vigente"
    assert reutilizacion_service.acreditaciones_pendientes_autorizacion(db, c.id) == [], \
        "la bandeja debe quedar vacía tras autorizar"
    print("PASS: autorizar_compartir -> ENVIADO anclado, bandeja vacía")

    print("TODOS LOS TESTS DE REUTILIZACIÓN PASARON")


if __name__ == "__main__":
    run()
