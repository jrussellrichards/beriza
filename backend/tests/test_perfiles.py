"""
Smoke test de perfiles de exigencias, contra SQLite.

Lo que importa no es que se cree un perfil, sino:

  1. que partir desde otro perfil copie tambien su PARAMETRIZACION —vigencias y
     umbrales son la parte tediosa; copiar solo la lista no ahorra nada,
  2. que sea una COPIA y no una herencia viva: editar el origen despues no
     puede cambiar lo que se le exige a un contratista que ya se acredita,
  3. que no se pueda copiar el perfil de OTRO mandante pasando su id,
  4. y que quitar un requisito borre su fila en vez de dejarla apagada.

Correr:  python tests/test_perfiles.py
"""
import os
import sys
import tempfile

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ.setdefault("DATABASE_URL", "postgresql://x:x@localhost/x")
os.environ.setdefault("JWT_SECRET", "test")
os.environ["FILE_STORAGE"] = "local"
os.environ["LOCAL_STORAGE_PATH"] = tempfile.mkdtemp(prefix="acredita_perfiles_")

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

import app.models  # noqa: F401
from app.core.exceptions import AsignacionInvalida
from app.models.base import Base
from app.models.mandante import Mandante
from app.models.pilar import Pilar, RequisitoDocumental, Subpilar
from app.models.servicio import PerfilRequisitoConfig
from app.domain import servicio_service


def run():
    eng = create_engine("sqlite://")
    Base.metadata.create_all(eng)
    db = Session(eng)

    codelco = Mandante(razon_social="Codelco", rut="61.704.000-K", slug="cod", plan="Pro")
    otro = Mandante(razon_social="Los Pelambres", rut="70.000.000-7", slug="lp", plan="Pro")
    db.add_all([codelco, otro]); db.flush()

    pilar = Pilar(codigo="LEGAL", nombre="Legal", orden=1); db.add(pilar); db.flush()
    sub = Subpilar(pilar_id=pilar.id, codigo="EMP", nombre="Empresa", orden=1); db.add(sub); db.flush()
    f30 = RequisitoDocumental(subpilar_id=sub.id, codigo="F30", nombre="Certificado F30",
                              entidad_tipo="EMPRESA", alcance="ENTIDAD")
    contrato = RequisitoDocumental(subpilar_id=sub.id, codigo="CONTRATO", nombre="Contrato",
                                   entidad_tipo="TRABAJADOR", alcance="ENTIDAD")
    db.add_all([f30, contrato]); db.commit()

    # ── 1. Un perfil con parametrizacion propia ──────────────────────────────
    base = servicio_service.crear_perfil(db, codelco.id, "Trabajador nuevo")
    servicio_service.configurar_requisito_perfil(
        db, perfil_id=base.id, requisito_documental_id=f30.id,
        es_obligatorio=True, vigencia_max_dias=90, umbral_deuda_max=250000)
    servicio_service.configurar_requisito_perfil(
        db, perfil_id=base.id, requisito_documental_id=contrato.id,
        es_obligatorio=True, vigencia_max_dias=365)
    db.commit()
    print("PASS: perfil base con dos requisitos parametrizados")

    # ── 2. Partir desde ese perfil copia TODO, no solo la lista ─────────────
    copia = servicio_service.crear_perfil(db, codelco.id, "Trabajador nuevo - turno noche",
                                          copiar_de=base.id)
    cfgs = {c.requisito_documental_id: c
            for c in db.query(PerfilRequisitoConfig).filter_by(perfil_id=copia.id).all()}
    assert len(cfgs) == 2, f"debio copiar 2 requisitos, copio {len(cfgs)}"
    assert cfgs[f30.id].vigencia_max_dias == 90, "no copio la vigencia"
    assert float(cfgs[f30.id].umbral_deuda_max) == 250000, "no copio el umbral de deuda"
    assert cfgs[contrato.id].vigencia_max_dias == 365
    print("PASS: la plantilla copia los requisitos CON su parametrizacion")

    # ── 3. Es una foto, no una herencia viva ────────────────────────────────
    # Si esto fallara, editar un perfil cambiaria en silencio lo que se le exige
    # a contratistas que ya se estan acreditando contra el perfil derivado.
    servicio_service.configurar_requisito_perfil(
        db, perfil_id=base.id, requisito_documental_id=f30.id,
        es_obligatorio=True, vigencia_max_dias=30, umbral_deuda_max=0)
    servicio_service.quitar_requisito_perfil(db, base.id, contrato.id)
    db.commit()

    cfgs = {c.requisito_documental_id: c
            for c in db.query(PerfilRequisitoConfig).filter_by(perfil_id=copia.id).all()}
    assert len(cfgs) == 2, "quitar un requisito del origen afecto a la copia"
    assert cfgs[f30.id].vigencia_max_dias == 90, "editar el origen cambio la vigencia de la copia"
    print("PASS: editar el perfil de origen NO toca al que partio de el")

    # ── 4. No se puede copiar el perfil de otro mandante ────────────────────
    ajeno = servicio_service.crear_perfil(db, otro.id, "Perfil ajeno")
    try:
        servicio_service.crear_perfil(db, codelco.id, "Robado", copiar_de=ajeno.id)
        raise AssertionError("copio el perfil de otro mandante pasando su id")
    except AsignacionInvalida as e:
        db.rollback()
        assert "organización" in str(e), f"el error debe decir por que: {e}"
    print("PASS: no se puede partir desde el perfil de otra organizacion")

    # ── 5. Quitar borra la fila, no la deja apagada ─────────────────────────
    # La pantalla vieja guardaba una fila es_obligatorio=False por cada
    # requisito tocado: un perfil con 12 exigencias arrastraba 44 filas.
    n_antes = db.query(PerfilRequisitoConfig).filter_by(perfil_id=copia.id).count()
    servicio_service.quitar_requisito_perfil(db, copia.id, f30.id)
    n_despues = db.query(PerfilRequisitoConfig).filter_by(perfil_id=copia.id).count()
    assert n_despues == n_antes - 1, f"la fila sigue ahi: {n_antes} -> {n_despues}"
    print("PASS: quitar un requisito borra su fila")

    # ── 6. Copiar un perfil vacio no explota ────────────────────────────────
    vacio = servicio_service.crear_perfil(db, codelco.id, "Vacio")
    desde_vacio = servicio_service.crear_perfil(db, codelco.id, "Desde vacio", copiar_de=vacio.id)
    assert db.query(PerfilRequisitoConfig).filter_by(perfil_id=desde_vacio.id).count() == 0
    print("PASS: partir desde un perfil sin requisitos no falla")

    print("TODOS LOS TESTS DE PERFILES PASARON")


if __name__ == "__main__":
    run()
