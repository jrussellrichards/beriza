"""
La empresa contratista lee y edita su propia ficha, por HTTP.

Observacion #2 del feedback del 2 de septiembre de 2026: "al ingresar a la
aplicacion como contratista no solicita los datos ni da alguna opcion para
registrarlos". El endpoint del mandante ya existia; faltaba que la propia empresa
pudiera completarlos.

Lo que se verifica:

  1. el contratista_admin ve y edita SU empresa (la del token, nunca una por URL),
  2. la edicion es parcial —completar la mutualidad no borra la direccion—,
  3. una mutualidad inventada y un RUT de representante malo se rechazan (misma
     validacion que usa el mandante, via contratista_service),
  4. el prevencionista puede VER pero no editar,
  5. y que operar sobre "mi empresa" jamas toca la de otro contratista: el
     endpoint sale del token, asi que no hay id ajeno que falsear.

Correr:  python tests/test_mi_empresa.py
"""
import os
import sys
import tempfile

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("JWT_SECRET", "test")
os.environ["FILE_STORAGE"] = "local"
os.environ["LOCAL_STORAGE_PATH"] = tempfile.mkdtemp(prefix="acredita_mi_empresa_")

from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.core.security import hash_password
from app.infrastructure.database import get_db
from app.models.base import Base
from app.models.contratista import EmpresaContratista
from app.models.usuario import Usuario

from tests._db import engine_sqlite
from main import app


def _headers(cliente, email):
    token = cliente.post("/api/v1/usuarios/login", json={
        "email": email, "password": "secreta-larga"}).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def run():
    eng = engine_sqlite(connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(eng)
    Sesion = sessionmaker(bind=eng)

    db = Sesion()
    app.dependency_overrides[get_db] = lambda: db
    cliente = TestClient(app)

    emp_a = EmpresaContratista(rut="77.111.222-3", razon_social="Contratista Alfa Ltda")
    emp_b = EmpresaContratista(rut="76.999.888-7", razon_social="Contratista Beta SpA")
    db.add_all([emp_a, emp_b]); db.flush()
    db.add_all([
        Usuario(email="admin@alfa.cl", password_hash=hash_password("secreta-larga"),
                rol="contratista_admin", nombre="Admin Alfa", activo=True, contratista_id=emp_a.id),
        Usuario(email="prev@alfa.cl", password_hash=hash_password("secreta-larga"),
                rol="prevencionista", nombre="Prevencion Alfa", activo=True, contratista_id=emp_a.id),
        Usuario(email="admin@beta.cl", password_hash=hash_password("secreta-larga"),
                rol="contratista_admin", nombre="Admin Beta", activo=True, contratista_id=emp_b.id),
    ])
    db.commit()

    # ── 1. El admin ve SU empresa ────────────────────────────────────────────
    ha = _headers(cliente, "admin@alfa.cl")
    r = cliente.get("/api/v1/contratistas/mi-empresa", headers=ha)
    assert r.status_code == 200, r.text
    assert r.json()["rut"] == "77.111.222-3", r.json()
    assert r.json()["razon_social"] == "Contratista Alfa Ltda"
    print("PASS: el contratista_admin ve la ficha de su propia empresa")

    # ── 2. Edicion parcial ───────────────────────────────────────────────────
    assert cliente.patch("/api/v1/contratistas/mi-empresa", headers=ha, json={
        "direccion": "Av. Balmaceda 1200, Antofagasta",
        "telefono_emergencia": "+56 9 8888 7777",
    }).status_code == 200
    assert cliente.patch("/api/v1/contratistas/mi-empresa", headers=ha, json={
        "mutualidad": "ACHS",
    }).status_code == 200
    ficha = cliente.get("/api/v1/contratistas/mi-empresa", headers=ha).json()
    assert ficha["mutualidad"] == "ACHS", ficha
    assert ficha["direccion"] == "Av. Balmaceda 1200, Antofagasta", (
        "completar la mutualidad borro la direccion: la edicion no fue parcial")
    print("PASS: la edicion es parcial, completar un campo no borra los otros")

    # ── 3. Validaciones de negocio ───────────────────────────────────────────
    r = cliente.patch("/api/v1/contratistas/mi-empresa", headers=ha, json={"mutualidad": "INVENTADA"})
    assert r.status_code == 400 and "ACHS" in r.json()["detail"], r.text
    r = cliente.patch("/api/v1/contratistas/mi-empresa", headers=ha, json={
        "representante_legal_rut": "11.111.111-2"})
    assert r.status_code == 400 and "verificador" in r.json()["detail"], r.text
    # Un rechazo no ensucia el campo
    assert cliente.get("/api/v1/contratistas/mi-empresa", headers=ha).json()["mutualidad"] == "ACHS"
    print("PASS: mutualidad inventada y RUT de representante malo se rechazan con 400")

    # ── 4. El prevencionista ve pero no edita ────────────────────────────────
    hp = _headers(cliente, "prev@alfa.cl")
    assert cliente.get("/api/v1/contratistas/mi-empresa", headers=hp).status_code == 200
    r = cliente.patch("/api/v1/contratistas/mi-empresa", headers=hp, json={"giro": "Cualquier cosa"})
    assert r.status_code == 403, f"el prevencionista pudo editar la ficha: {r.status_code}"
    print("PASS: el prevencionista ve la ficha pero no puede editarla")

    # ── 5. Operar sobre mi empresa nunca toca la de otro ─────────────────────
    hb = _headers(cliente, "admin@beta.cl")
    assert cliente.patch("/api/v1/contratistas/mi-empresa", headers=hb, json={
        "direccion": "Otra direccion, Santiago"}).status_code == 200
    # La de Alfa sigue intacta: el endpoint sale del token de Beta, no de un id.
    assert cliente.get("/api/v1/contratistas/mi-empresa", headers=ha).json()["direccion"] == (
        "Av. Balmaceda 1200, Antofagasta"), "editar Beta toco la ficha de Alfa"
    assert cliente.get("/api/v1/contratistas/mi-empresa", headers=hb).json()["razon_social"] == (
        "Contratista Beta SpA")
    print("PASS: cada empresa solo se edita a si misma; no hay id ajeno que falsear")

    db.close()
    app.dependency_overrides.clear()
    print("TODOS LOS TESTS DE MI-EMPRESA PASARON")


if __name__ == "__main__":
    run()


# ── Puente para pytest ────────────────────────────────────────────────────────
def test_mi_empresa():
    run()
