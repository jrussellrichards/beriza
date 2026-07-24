"""
Smoke test de la reutilización documental entre mandantes (Fase 2), contra SQLite.

Cubre: un mandante nuevo exige requisitos ENTIDAD que el contratista ya tiene
resueltos -> se crean acreditaciones reutilizando la entrega vigente.
  - requisito genérico -> ENVIADO apuntando a la entrega vigente
  - requisito sensible -> PENDIENTE_AUTORIZACION, sin compartir la entrega
  - autorizar -> el sensible pasa a ENVIADO y queda anclado
  - rechazar -> se descarta y no se vuelve a proponer
  - idempotencia -> reconciliar de nuevo no duplica acreditaciones
  - alcance SERVICIO -> nunca se reutiliza entre mandantes
  - capa API (bandeja + autorizar + rechazar + aislamiento entre contratistas)

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
from app.api import reutilizacion as api_reuso
from app.domain import reutilizacion_service
from app.domain.estados import EstadoAcreditacion, EstadoDocumento, EstadoServicio

# El servicio usa date.today() (no recibe `hoy`), así que las fechas del test
# son relativas al día real — si no, el test caduca solo.
HOY = date.today()
FUTURO = HOY + timedelta(days=180)
PASADO = HOY - timedelta(days=30)


def _requisito(db, sub, codigo, alcance="ENTIDAD", sensible=False):
    r = RequisitoDocumental(subpilar_id=sub.id, codigo=codigo, nombre=codigo,
                            entidad_tipo="EMPRESA", alcance=alcance, sensible=sensible)
    db.add(r); db.flush()
    return r


def _expediente_vigente(db, req, empresa, vigencia=None):
    exp = Expediente(requisito_id=req.id, empresa_id=empresa.id)
    db.add(exp); db.flush()
    e = Entrega(expediente_id=exp.id, numero_version=1,
                fecha_vigencia_hasta=vigencia if vigencia is not None else FUTURO)
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
    req_sens = _requisito(db, sub, "CARPETA_TRIB", sensible=True)        # sensible -> autorizado
    req_sens2 = _requisito(db, sub, "FINIQUITOS", sensible=True)         # sensible -> rechazado
    req_srv = _requisito(db, sub, "MIPER", alcance="SERVICIO")           # SERVICIO -> ignorado
    req_exp = _requisito(db, sub, "DAS", sensible=False)                 # caducado -> ignorado

    # El contratista ya tiene resueltos los ENTIDAD (no el de servicio); el DAS
    # lo tiene pero caducado, así que no hay nada vigente que reutilizar.
    exp_gen = _expediente_vigente(db, req_gen, c)
    exp_sens = _expediente_vigente(db, req_sens, c)
    exp_sens2 = _expediente_vigente(db, req_sens2, c)
    _expediente_vigente(db, req_exp, c, vigencia=PASADO)

    # Perfil del mandante nuevo que exige los cinco requisitos + un servicio activo.
    perfil = PerfilRequisitos(mandante_id=m.id, nombre="Obras"); db.add(perfil); db.flush()
    for r in (req_gen, req_sens, req_sens2, req_srv, req_exp):
        db.add(PerfilRequisitoConfig(perfil_id=perfil.id, requisito_documental_id=r.id,
                                     es_obligatorio=True, vigencia_max_dias=365))
    db.add(Servicio(contratista_mandante_id=rel.id, perfil_requisitos_id=perfil.id,
                    nombre="Faena 1", fecha_inicio=HOY, estado=EstadoServicio.ACTIVO))
    db.commit()

    creadas = reutilizacion_service.reconciliar_reutilizacion(db, c.id, m.id)
    assert len(creadas) == 3, f"debieron crearse 3 acreditaciones (1 genérico + 2 sensibles), fueron {len(creadas)}"

    a_gen = _acred_de(db, exp_gen, m)
    a_sens = _acred_de(db, exp_sens, m)
    a_sens2 = _acred_de(db, exp_sens2, m)
    assert a_gen.estado == EstadoDocumento.ENVIADO, "el genérico debe quedar ENVIADO"
    assert a_gen.entrega_id is not None, "el genérico debe quedar anclado a la entrega vigente"
    print("PASS: requisito genérico -> ENVIADO anclado a la entrega vigente")

    assert a_sens.estado == EstadoDocumento.PENDIENTE_AUTORIZACION, "el sensible debe quedar PENDIENTE"
    assert a_sens.entrega_id is None, "el sensible NO debe compartir la entrega antes de autorizar"
    print("PASS: requisito sensible -> PENDIENTE_AUTORIZACION sin compartir la entrega")

    # Ni el de alcance SERVICIO ni el caducado generan acreditación reutilizada.
    assert db.query(Acreditacion).filter_by(mandante_id=m.id).count() == 3, \
        "ni el alcance SERVICIO ni el documento caducado deben reutilizarse"
    print("PASS: alcance SERVICIO -> no se reutiliza entre mandantes")
    print("PASS: documento caducado -> no se reutiliza (queda como brecha)")

    # Idempotencia: reconciliar de nuevo no duplica.
    creadas2 = reutilizacion_service.reconciliar_reutilizacion(db, c.id, m.id)
    assert creadas2 == [], f"la segunda corrida no debe crear nada: {creadas2}"
    assert db.query(Acreditacion).filter_by(mandante_id=m.id).count() == 3, "no debe haber duplicados"
    print("PASS: idempotente (segunda reconciliación no duplica)")

    # Bandeja (capa API): lista los dos sensibles pendientes con su contexto.
    usuario = db.query(Usuario).filter_by(contratista_id=c.id).first()
    solicitudes = api_reuso.listar_solicitudes(db=db, usuario=usuario)
    assert {s.acreditacion_id for s in solicitudes} == {a_sens.id, a_sens2.id}, \
        "la bandeja debe traer solo los sensibles pendientes"
    s_gen = next(s for s in solicitudes if s.acreditacion_id == a_sens.id)
    assert s_gen.mandante_razon_social == "Falabella" and s_gen.requisito_codigo == "CARPETA_TRIB"
    assert s_gen.numero_version_vigente == 1 and s_gen.fecha_vigencia_hasta == FUTURO
    print("PASS: bandeja API lista los sensibles con mandante, requisito y vigencia")

    # Autorizar: se comparte la entrega vigente y queda a revisión del mandante.
    api_reuso.autorizar(acreditacion_id=a_sens.id, db=db, usuario=usuario)
    db.refresh(a_sens)
    assert a_sens.estado == EstadoDocumento.ENVIADO, "tras autorizar debe pasar a ENVIADO"
    assert a_sens.entrega_id is not None, "tras autorizar debe quedar anclado a la entrega vigente"
    print("PASS: autorizar -> ENVIADO anclado a la entrega vigente")

    # Rechazar: se descarta y NO se vuelve a proponer en la próxima reconciliación.
    api_reuso.rechazar(acreditacion_id=a_sens2.id, db=db, usuario=usuario)
    db.refresh(a_sens2)
    assert a_sens2.eliminado_en is not None, "tras rechazar debe quedar descartada"
    assert a_sens2.entrega_id is None, "una acreditación rechazada nunca compartió la entrega"
    assert api_reuso.listar_solicitudes(db=db, usuario=usuario) == [], "la bandeja debe quedar vacía"
    assert reutilizacion_service.reconciliar_reutilizacion(db, c.id, m.id) == [], \
        "el rechazo debe ser durable: no se vuelve a proponer"
    print("PASS: rechazar -> descartada, bandeja vacía y no se vuelve a proponer")

    # Aislamiento: el admin de otro contratista no puede resolver esta solicitud.
    otro = EmpresaContratista(rut="76.3-3", razon_social="XYZ"); db.add(otro); db.flush()
    intruso = Usuario(email="ct@xyz.cl", password_hash="x", rol="contratista_admin",
                      nombre="XYZ", contratista_id=otro.id, activo=True)
    db.add(intruso); db.commit()
    try:
        api_reuso.autorizar(acreditacion_id=a_gen.id, db=db, usuario=intruso)
        raise AssertionError("un contratista ajeno no debio poder resolver la solicitud")
    except HTTPException as e:
        assert e.status_code == 404, f"debio ser 404 (no revelar existencia), fue {e.status_code}"
    print("PASS: contratista ajeno -> 404 (aislamiento multi-tenant)")

    print("TODOS LOS TESTS DE REUTILIZACIÓN PASARON")


if __name__ == "__main__":
    run()
