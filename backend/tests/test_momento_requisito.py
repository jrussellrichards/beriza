"""
Cuando se le exige cada documento al contratista dentro de la vida del servicio.

Existe por un problema concreto: la app exigia TODO desde el dia cero, incluidos
documentos que en el dia cero no pueden existir. El F30-1 del mes anterior de una
obra que parte hoy no existe. Las liquidaciones del mes en curso tampoco. El
contratista figuraba incompleto por no entregar algo imposible, y el mandante
veia una brecha que no lo era.

Lo que se verifica:

  1. que un requisito RECURRENTE no cuente como brecha antes de que cierre su
     primer periodo,
  2. que si cuente una vez cerrado,
  3. que uno de TERMINO no se exija mientras el servicio esta activo,
  4. que ARRANQUE siga comportandose como siempre — es el default y no puede
     cambiar el resultado de ningun perfil existente,
  5. y que el momento viaje en la copia al partir un perfil desde otro.

Correr:  python tests/test_momento_requisito.py
"""
import os
import sys
import tempfile
from datetime import date, timedelta

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("JWT_SECRET", "test")
os.environ["FILE_STORAGE"] = "local"
os.environ["LOCAL_STORAGE_PATH"] = tempfile.mkdtemp(prefix="acredita_momento_")

from sqlalchemy.orm import Session

import app.models  # noqa: F401
from app.domain import acreditacion_service, servicio_service
from app.domain.estados import EstadoServicio, MomentoRequisito
from app.models.base import Base
from app.models.contratista import ContratistaMandante, EmpresaContratista
from app.models.mandante import Mandante
from app.models.pilar import Pilar, RequisitoDocumental, Subpilar
from app.models.servicio import PerfilRequisitoConfig, PerfilRequisitos, Servicio

from tests._db import engine_sqlite

HOY = date.today()


def _faltantes(db, servicio_id):
    """Codigos de requisito que el avance reporta como no entregados."""
    avance = acreditacion_service.obtener_avance_servicio(db, servicio_id)
    return {
        item.requisito_codigo
        for pilar in avance.pilares
        for item in pilar.requisitos
        if item.estado is None
    }


def run():
    eng = engine_sqlite()
    Base.metadata.create_all(eng)
    db = Session(eng)

    m = Mandante(razon_social="Constructora", rut="76.1-9", slug="c", plan="Pro")
    c = EmpresaContratista(razon_social="Contratista", rut="77.2-8")
    db.add_all([m, c]); db.flush()
    rel = ContratistaMandante(mandante_id=m.id, contratista_id=c.id); db.add(rel); db.flush()

    pilar = Pilar(codigo="LEGAL", nombre="Legal", orden=1); db.add(pilar); db.flush()
    sub = Subpilar(pilar_id=pilar.id, codigo="EMP", nombre="Empresa", orden=1); db.add(sub); db.flush()
    f30 = RequisitoDocumental(subpilar_id=sub.id, codigo="F30", nombre="F30",
                              entidad_tipo="EMPRESA", alcance="ENTIDAD")
    f30_1 = RequisitoDocumental(subpilar_id=sub.id, codigo="F30_1", nombre="F30-1 mensual",
                                entidad_tipo="EMPRESA", alcance="ENTIDAD")
    finiquito = RequisitoDocumental(subpilar_id=sub.id, codigo="FINIQUITO", nombre="Finiquito",
                                    entidad_tipo="EMPRESA", alcance="ENTIDAD")
    db.add_all([f30, f30_1, finiquito]); db.commit()

    perfil = servicio_service.crear_perfil(db, m.id, "Obra")
    servicio_service.configurar_requisito_perfil(
        db, perfil_id=perfil.id, requisito_documental_id=f30.id,
        es_obligatorio=True, vigencia_max_dias=30, momento=MomentoRequisito.ARRANQUE)
    servicio_service.configurar_requisito_perfil(
        db, perfil_id=perfil.id, requisito_documental_id=f30_1.id,
        es_obligatorio=True, vigencia_max_dias=30, momento=MomentoRequisito.RECURRENTE)
    servicio_service.configurar_requisito_perfil(
        db, perfil_id=perfil.id, requisito_documental_id=finiquito.id,
        es_obligatorio=True, vigencia_max_dias=365, momento=MomentoRequisito.TERMINO)
    db.commit()

    # ── 1. Servicio que parte HOY: el recurrente y el de termino no se exigen ─
    recien = Servicio(contratista_mandante_id=rel.id, perfil_requisitos_id=perfil.id,
                      nombre="Obra nueva", fecha_inicio=HOY, estado=EstadoServicio.ACTIVO)
    db.add(recien); db.commit()

    faltan = _faltantes(db, recien.id)
    assert "F30" in faltan, "el de arranque SI debe exigirse desde el dia uno"
    assert "F30_1" not in faltan, (
        "el F30-1 mensual no puede exigirse el dia que parte la obra: "
        "el del mes anterior no existe")
    assert "FINIQUITO" not in faltan, "el finiquito no se exige con el servicio activo"
    print("PASS: el dia uno solo se exige lo de arranque")

    # ── 2. Pasado el primer periodo, el recurrente SI se exige ───────────────
    viejo = Servicio(contratista_mandante_id=rel.id, perfil_requisitos_id=perfil.id,
                     nombre="Obra en curso", fecha_inicio=HOY - timedelta(days=45),
                     estado=EstadoServicio.ACTIVO)
    db.add(viejo); db.commit()

    faltan = _faltantes(db, viejo.id)
    assert "F30_1" in faltan, (
        "a los 45 dias, con periodo de 30, el mensual ya debe exigirse")
    assert "FINIQUITO" not in faltan, "sigue activo: el finiquito todavia no"
    print("PASS: cerrado el primer periodo, el recurrente se exige")

    # ── 3. Servicio terminado: ahora si se exige el de termino ───────────────
    viejo.estado = EstadoServicio.TERMINADO
    db.commit()
    faltan = _faltantes(db, viejo.id)
    assert "FINIQUITO" in faltan, "al terminar el servicio, el finiquito se exige"
    print("PASS: el de termino se exige al cerrar el servicio")

    # ── 4. ARRANQUE es el default y no cambia nada de lo que ya existia ──────
    # Un perfil creado sin tocar el momento debe comportarse como siempre.
    otro = servicio_service.crear_perfil(db, m.id, "Sin momento")
    servicio_service.configurar_requisito_perfil(
        db, perfil_id=otro.id, requisito_documental_id=f30_1.id,
        es_obligatorio=True, vigencia_max_dias=30)
    db.commit()
    cfg = db.query(PerfilRequisitoConfig).filter_by(perfil_id=otro.id).first()
    assert cfg.momento == MomentoRequisito.ARRANQUE, f"el default debe ser ARRANQUE, fue {cfg.momento}"

    s3 = Servicio(contratista_mandante_id=rel.id, perfil_requisitos_id=otro.id,
                  nombre="Sin momento", fecha_inicio=HOY, estado=EstadoServicio.ACTIVO)
    db.add(s3); db.commit()
    assert "F30_1" in _faltantes(db, s3.id), (
        "sin momento explicito se comporta como ARRANQUE: se exige desde el dia uno")
    print("PASS: ARRANQUE es el default y conserva el comportamiento de siempre")

    # ── 5. El momento viaja al partir un perfil desde otro ───────────────────
    copia = servicio_service.crear_perfil(db, m.id, "Obra - copia", copiar_de=perfil.id)
    momentos = {
        db.get(RequisitoDocumental, cfg.requisito_documental_id).codigo: cfg.momento
        for cfg in db.query(PerfilRequisitoConfig).filter_by(perfil_id=copia.id).all()
    }
    assert momentos == {"F30": "ARRANQUE", "F30_1": "RECURRENTE", "FINIQUITO": "TERMINO"}, momentos
    print("PASS: la copia de un perfil conserva el momento de cada requisito")

    print("TODOS LOS TESTS DE MOMENTO PASARON")


if __name__ == "__main__":
    run()


# ── Puente para pytest ────────────────────────────────────────────────────────
def test_momento_requisito():
    run()
