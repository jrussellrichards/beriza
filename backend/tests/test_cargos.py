"""
Cargos: el catalogo con el que se decide a quien se le pide cada documento.

No tenia ni un test, y gobierna una regla de negocio real: la matriz
cargo x requisito es lo que permite exigirle la licencia de conducir al conductor
y no a la administrativa.

Se escribe ahora porque la pantalla pasa a usar dos operaciones que el backend ya
soportaba y nadie ejercitaba —renombrar y desactivar—. Sin cobertura, el dia que
alguien toque este router la interfaz se rompe en silencio.

Lo que se verifica:

  1. renombrar cambia nombre y area, y el area se normaliza a mayusculas,
  2. desactivar saca el cargo del listado por defecto pero sigue estando con
     ?incluir_inactivos=true —que es como la pantalla lo recupera para reactivarlo—,
  3. un cargo EN USO no se puede borrar, y el error dice que se desactive,
  4. uno libre si se borra,
  5. nadie toca los cargos de otra organizacion ni los del catalogo global,
  6. y el set sugerido es idempotente.

Correr:  python tests/test_cargos.py
"""
import os
import sys
import tempfile
import uuid

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("JWT_SECRET", "test")
os.environ["FILE_STORAGE"] = "local"
os.environ["LOCAL_STORAGE_PATH"] = tempfile.mkdtemp(prefix="acredita_cargos_")

from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.core.security import hash_password
from app.domain import servicio_service
from app.infrastructure.database import get_db
from app.models.base import Base
from app.models.cargo import Cargo
from app.models.mandante import Mandante
from app.models.pilar import Pilar, RequisitoDocumental, Subpilar
from app.models.servicio import PerfilRequisitoCargo, PerfilRequisitoConfig
from app.models.usuario import Usuario

from tests._db import engine_sqlite
from main import app


def _headers(cliente, email):
    token = cliente.post("/api/v1/usuarios/login", json={
        "email": email, "password": "secreta-larga"}).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _codigos(cliente, headers, inactivos=False):
    url = "/api/v1/cargos/" + ("?incluir_inactivos=true" if inactivos else "")
    return {c["codigo"] for c in cliente.get(url, headers=headers).json()}


def run():
    eng = engine_sqlite(connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(eng)
    db = sessionmaker(bind=eng)()
    app.dependency_overrides[get_db] = lambda: db
    cliente = TestClient(app)

    codelco = Mandante(razon_social="Codelco", rut="61.704.000-K", slug="cod", plan="Pro")
    otro = Mandante(razon_social="Los Pelambres", rut="70.000.000-7", slug="lp", plan="Pro")
    db.add_all([codelco, otro]); db.flush()
    db.add_all([
        Usuario(email="jefa@cod.cl", password_hash=hash_password("secreta-larga"),
                rol="mandante_admin", nombre="Jefa", activo=True, mandante_id=codelco.id),
        Usuario(email="jefa@lp.cl", password_hash=hash_password("secreta-larga"),
                rol="mandante_admin", nombre="Ajena", activo=True, mandante_id=otro.id),
    ])
    # Cargo del catalogo global: no es de nadie y nadie lo edita desde su portal.
    db.add(Cargo(mandante_id=None, codigo="GLOBAL", nombre="Cargo global"))
    pilar = Pilar(codigo="LEGAL", nombre="Legal", orden=1); db.add(pilar); db.flush()
    sub = Subpilar(pilar_id=pilar.id, codigo="PER", nombre="Personas", orden=1); db.add(sub); db.flush()
    req = RequisitoDocumental(subpilar_id=sub.id, codigo="LICENCIA", nombre="Licencia de conducir",
                              entidad_tipo="TRABAJADOR", alcance="ENTIDAD")
    db.add(req); db.commit()

    h = _headers(cliente, "jefa@cod.cl")

    # ── 1. Crear y renombrar ─────────────────────────────────────────────────
    r = cliente.post("/api/v1/cargos/", headers=h,
                     json={"codigo": "CONDUCTOR", "nombre": "Conductor", "area": "operaciones"})
    assert r.status_code == 201, r.text
    cargo_id = [c for c in cliente.get("/api/v1/cargos/", headers=h).json()
                if c["codigo"] == "CONDUCTOR"][0]["id"]

    r = cliente.patch(f"/api/v1/cargos/{cargo_id}", headers=h,
                      json={"nombre": "Operador equipo pesado", "area": "faena"})
    assert r.status_code == 200, r.text
    actualizado = [c for c in cliente.get("/api/v1/cargos/", headers=h).json()
                   if c["codigo"] == "CONDUCTOR"][0]
    assert actualizado["nombre"] == "Operador equipo pesado", actualizado
    assert actualizado["area"] == "FAENA", (
        f"el area no se normalizo a mayusculas: {actualizado['area']!r}")
    print("PASS: renombrar cambia nombre y area, y el area se normaliza")

    # ── 2. Desactivar lo saca del listado, pero se puede recuperar ───────────
    assert cliente.patch(f"/api/v1/cargos/{cargo_id}", headers=h,
                         json={"activo": False}).status_code == 200
    assert "CONDUCTOR" not in _codigos(cliente, h), (
        "un cargo desactivado sigue apareciendo como columna de la matriz")
    assert "CONDUCTOR" in _codigos(cliente, h, inactivos=True), (
        "un cargo desactivado desaparecio del todo: no habria forma de reactivarlo")
    print("PASS: desactivar lo saca de la matriz pero sigue visible con incluir_inactivos")

    assert cliente.patch(f"/api/v1/cargos/{cargo_id}", headers=h,
                         json={"activo": True}).status_code == 200
    assert "CONDUCTOR" in _codigos(cliente, h)
    print("PASS: reactivar lo devuelve al listado")

    # ── 3. Un cargo EN USO no se borra, y el error ofrece la salida ─────────
    perfil = servicio_service.crear_perfil(db, codelco.id, "Transporte")
    servicio_service.configurar_requisito_perfil(
        db, perfil_id=perfil.id, requisito_documental_id=req.id,
        es_obligatorio=True, vigencia_max_dias=90)
    cfg = db.query(PerfilRequisitoConfig).filter_by(perfil_id=perfil.id).first()
    # uuid.UUID() y no el string crudo del JSON: la columna es UUID y SQLite no
    # lo adapta solo —revienta con "'str' object has no attribute 'hex'"—.
    db.add(PerfilRequisitoCargo(
        perfil_requisito_config_id=cfg.id, cargo_id=uuid.UUID(cargo_id),
    ))
    db.commit()

    r = cliente.delete(f"/api/v1/cargos/{cargo_id}", headers=h)
    assert r.status_code == 400, f"se borro un cargo en uso: {r.status_code}"
    detalle = r.json()["detail"]
    # "esact" y no "esactiv": el mensaje dice "Desactivalo" con tilde en la i.
    assert "en uso" in detalle and "esact" in detalle, (
        f"el error no dice que esta en uso ni ofrece desactivarlo: {detalle}")
    print("PASS: un cargo en uso no se borra y el error dice que se desactive")

    # ── 4. Uno libre si se borra ─────────────────────────────────────────────
    cliente.post("/api/v1/cargos/", headers=h, json={"codigo": "SOBRA", "nombre": "Sobra"})
    libre = [c for c in cliente.get("/api/v1/cargos/", headers=h).json()
             if c["codigo"] == "SOBRA"][0]["id"]
    assert cliente.delete(f"/api/v1/cargos/{libre}", headers=h).status_code == 204
    assert "SOBRA" not in _codigos(cliente, h, inactivos=True)
    print("PASS: un cargo que nadie usa se borra de verdad")

    # ── 5. Aislamiento: ni de otra organizacion ni del catalogo global ──────
    ajena = _headers(cliente, "jefa@lp.cl")
    assert cliente.patch(f"/api/v1/cargos/{cargo_id}", headers=ajena,
                         json={"nombre": "Robado"}).status_code == 403
    assert cliente.delete(f"/api/v1/cargos/{cargo_id}", headers=ajena).status_code == 403
    # El de otro mandante ni siquiera se lista
    assert "CONDUCTOR" not in _codigos(cliente, ajena, inactivos=True)

    global_id = str(db.query(Cargo).filter_by(codigo="GLOBAL").first().id)
    assert cliente.patch(f"/api/v1/cargos/{global_id}", headers=h,
                         json={"nombre": "Mio ahora"}).status_code == 403
    assert cliente.delete(f"/api/v1/cargos/{global_id}", headers=h).status_code == 403
    # Pero SI lo ve: el catalogo global es de todos.
    assert "GLOBAL" in _codigos(cliente, h)
    print("PASS: no se tocan cargos de otra organizacion ni del catalogo global")

    # ── 6. El set sugerido es idempotente ───────────────────────────────────
    primera = cliente.post("/api/v1/cargos/set-sugerido", headers=h, json={}).json()
    segunda = cliente.post("/api/v1/cargos/set-sugerido", headers=h, json={}).json()
    assert len(primera["creados"]) > 0, primera
    assert segunda["creados"] == [], (
        f"apretarlo dos veces duplico cargos: {segunda['creados']}")
    print(f"PASS: el set sugerido crea {len(primera['creados'])} cargos y no duplica al repetir")

    db.close()
    app.dependency_overrides.clear()
    print("TODOS LOS TESTS DE CARGOS PASARON")


if __name__ == "__main__":
    run()


# ── Puente para pytest ────────────────────────────────────────────────────────
def test_cargos():
    run()
