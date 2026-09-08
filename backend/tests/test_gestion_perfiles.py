"""
Renombrar y eliminar perfiles de exigencias.

Observacion #3 del feedback del 2 de septiembre: "en perfiles de exigencias no
tengo opcion de eliminar perfiles, intente eliminar los perfiles creados como
prueba y no se puede". No existia en ninguna capa.

Lo que se verifica:

  1. renombrar cambia el nombre y rechaza un nombre ya usado y uno vacio,
  2. no se puede renombrar ni borrar el perfil de otra organizacion,
  3. un perfil que ningun servicio usa se borra de verdad, y con el se van sus
     filas de configuracion y su matriz de cargos (cascade, con FKs encendidas),
  4. un perfil que un servicio referencia NO se borra: se rechaza con PerfilEnUso.

Usa engine_sqlite() con PRAGMA foreign_keys=ON: sin eso, borrar el perfil dejando
configs colgando pasaria en verde y solo fallaria en el Postgres de produccion.

Correr:  python tests/test_gestion_perfiles.py
"""
import os
import sys
import tempfile
from datetime import date

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("JWT_SECRET", "test")
os.environ["FILE_STORAGE"] = "local"
os.environ["LOCAL_STORAGE_PATH"] = tempfile.mkdtemp(prefix="acredita_gestion_perfiles_")

from sqlalchemy import text
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401
from app.core.exceptions import AsignacionInvalida, PerfilEnUso
from app.domain import servicio_service
from app.models.base import Base
from app.models.cargo import Cargo
from app.models.contratista import ContratistaMandante, EmpresaContratista
from app.models.mandante import Mandante
from app.models.pilar import Pilar, RequisitoDocumental, Subpilar
from app.models.servicio import (
    PerfilRequisitoCargo, PerfilRequisitoConfig, PerfilRequisitos, Servicio,
)

from tests._db import engine_sqlite


def run():
    eng = engine_sqlite()
    Base.metadata.create_all(eng)
    with eng.connect() as c:
        assert c.execute(text("PRAGMA foreign_keys")).scalar() == 1, (
            "las claves foraneas estan apagadas: este test no probaria el cascade")
    db = sessionmaker(bind=eng)()

    codelco = Mandante(razon_social="Codelco", rut="61.704.000-K", slug="cod", plan="Pro")
    otro = Mandante(razon_social="Los Pelambres", rut="70.000.000-7", slug="lp", plan="Pro")
    emp = EmpresaContratista(rut="77.222.333-6", razon_social="Contratista Demo")
    db.add_all([codelco, otro, emp]); db.flush()
    rel = ContratistaMandante(mandante_id=codelco.id, contratista_id=emp.id)
    db.add(rel)
    pilar = Pilar(codigo="LEGAL", nombre="Legal", orden=1); db.add(pilar); db.flush()
    sub = Subpilar(pilar_id=pilar.id, codigo="PER", nombre="Personas", orden=1); db.add(sub); db.flush()
    req = RequisitoDocumental(subpilar_id=sub.id, codigo="LICENCIA", nombre="Licencia de conducir",
                             entidad_tipo="TRABAJADOR", alcance="ENTIDAD")
    db.add(req); db.commit()

    # ── 1. Renombrar ─────────────────────────────────────────────────────────
    p = servicio_service.crear_perfil(db, codelco.id, "Perfil prueba 123")
    servicio_service.renombrar_perfil(db, p.id, codelco.id, nombre="Transporte pesado",
                                      descripcion="Faenas con conduccion")
    db.refresh(p)
    assert p.nombre == "Transporte pesado", p.nombre
    assert p.descripcion == "Faenas con conduccion"
    print("PASS: renombrar cambia nombre y descripcion")

    # Nombre duplicado dentro del mismo mandante se rechaza
    servicio_service.crear_perfil(db, codelco.id, "Obras civiles")
    try:
        servicio_service.renombrar_perfil(db, p.id, codelco.id, nombre="Obras civiles")
        raise AssertionError("se acepto un nombre de perfil ya usado")
    except AsignacionInvalida as e:
        assert "Obras civiles" in str(e), e
    # Nombre vacio se rechaza
    try:
        servicio_service.renombrar_perfil(db, p.id, codelco.id, nombre="   ")
        raise AssertionError("se acepto un nombre vacio")
    except AsignacionInvalida:
        pass
    db.refresh(p)
    assert p.nombre == "Transporte pesado", f"un rechazo dejo el nombre sucio: {p.nombre}"
    print("PASS: nombre duplicado y nombre vacio se rechazan sin ensuciar el perfil")

    # ── 2. No cruza organizaciones ───────────────────────────────────────────
    ajeno = servicio_service.crear_perfil(db, otro.id, "Perfil de otro")
    for accion in (
        lambda: servicio_service.renombrar_perfil(db, ajeno.id, codelco.id, nombre="Robado"),
        lambda: servicio_service.eliminar_perfil(db, ajeno.id, codelco.id),
    ):
        try:
            accion()
            raise AssertionError("se pudo operar sobre el perfil de otro mandante")
        except AsignacionInvalida:
            pass
    print("PASS: no se puede renombrar ni borrar el perfil de otra organizacion")

    # ── 3. Borrar un perfil sin servicios se lleva configs y cargos ──────────
    borrable = servicio_service.crear_perfil(db, codelco.id, "Para borrar")
    servicio_service.configurar_requisito_perfil(
        db, perfil_id=borrable.id, requisito_documental_id=req.id,
        es_obligatorio=True, vigencia_max_dias=90)
    cfg = db.query(PerfilRequisitoConfig).filter_by(perfil_id=borrable.id).first()
    cargo = Cargo(codigo="CONDUCTOR", nombre="Conductor", mandante_id=codelco.id)
    db.add(cargo); db.flush()
    db.add(PerfilRequisitoCargo(perfil_requisito_config_id=cfg.id, cargo_id=cargo.id))
    db.commit()
    assert servicio_service.servicios_que_usan_perfil(db, borrable.id) == 0

    servicio_service.eliminar_perfil(db, borrable.id, codelco.id)
    assert db.get(PerfilRequisitos, borrable.id) is None, "el perfil no se borro"
    assert db.query(PerfilRequisitoConfig).filter_by(perfil_id=borrable.id).count() == 0, (
        "quedaron configs colgando del perfil borrado")
    assert db.query(PerfilRequisitoCargo).filter_by(perfil_requisito_config_id=cfg.id).count() == 0, (
        "quedo la matriz de cargos colgando del config borrado")
    print("PASS: un perfil sin servicios se borra, con sus configs y su matriz de cargos")

    # ── 4. Un perfil en uso NO se borra ──────────────────────────────────────
    en_uso = servicio_service.crear_perfil(db, codelco.id, "Perfil en uso")
    servicio_service.crear_servicio(db, codelco.id, emp.id, en_uso.id, "Faena viva", date.today())
    assert servicio_service.servicios_que_usan_perfil(db, en_uso.id) == 1
    try:
        servicio_service.eliminar_perfil(db, en_uso.id, codelco.id)
        raise AssertionError("se borro un perfil que un servicio usa")
    except PerfilEnUso as e:
        assert "1 servicio" in str(e), e
    assert db.get(PerfilRequisitos, en_uso.id) is not None, "el perfil en uso desaparecio"
    print("PASS: un perfil que un servicio referencia no se puede borrar")

    db.close()
    print("TODOS LOS TESTS DE GESTION DE PERFILES PASARON")


if __name__ == "__main__":
    run()


# ── Puente para pytest ────────────────────────────────────────────────────────
def test_gestion_perfiles():
    run()
