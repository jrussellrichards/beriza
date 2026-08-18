"""
El endpoint que alimenta la pantalla de perfiles, por HTTP.

Existe por un bug concreto: `_perfil_por_defecto` se borro en el commit 6e7c4da
y su llamada quedo huerfana, asi que GET /requisitos SIN perfil_id respondia 500
por NameError en vez del 404 que prometia su docstring. Ningun test lo agarro
porque todos ejercitan el dominio y no la ruta, y la pantalla siempre manda el
parametro.

Correr:  python tests/test_requisitos_endpoint.py
"""
import os
import sys
import tempfile

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("JWT_SECRET", "test")
os.environ["FILE_STORAGE"] = "local"
os.environ["LOCAL_STORAGE_PATH"] = tempfile.mkdtemp(prefix="acredita_reqs_")

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.core.security import hash_password
from app.infrastructure.database import get_db
from app.models.base import Base
from app.models.mandante import Mandante
from app.models.pilar import Pilar, RequisitoDocumental, Subpilar
from app.models.servicio import PerfilRequisitos
from app.models.usuario import Usuario
from main import app


def run():
    # StaticPool y check_same_thread=False son obligatorios: TestClient corre la
    # app en OTRO hilo, y sqlite en memoria con el pool por defecto le daria a
    # ese hilo una base vacia distinta. Sin esto el test falla con "no such
    # table: usuarios" aunque las tablas existan.
    eng = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(eng)
    Sesion = sessionmaker(bind=eng)

    db = Sesion()
    app.dependency_overrides[get_db] = lambda: db
    cliente = TestClient(app)

    codelco = Mandante(razon_social="Codelco", rut="61.704.000-K", slug="cod", plan="Pro")
    db.add(codelco); db.flush()
    db.add(Usuario(email="jefa@cod.cl", password_hash=hash_password("secreta-larga"),
                   rol="mandante_admin", nombre="Jefa", activo=True, mandante_id=codelco.id))

    pilar = Pilar(codigo="LEGAL", nombre="Legal", orden=1); db.add(pilar); db.flush()
    sub = Subpilar(pilar_id=pilar.id, codigo="EMP", nombre="Empresa", orden=1); db.add(sub); db.flush()
    db.add(RequisitoDocumental(subpilar_id=sub.id, codigo="F30", nombre="Certificado F30",
                               entidad_tipo="EMPRESA", alcance="ENTIDAD"))
    db.commit()

    token = cliente.post("/api/v1/usuarios/login", json={
        "email": "jefa@cod.cl", "password": "secreta-larga"}).json()["access_token"]
    h = {"Authorization": f"Bearer {token}"}
    base = f"/api/v1/mandantes/{codelco.id}/requisitos"

    # ── 1. Sin perfiles y sin perfil_id: 404 con explicacion, NUNCA 500 ──────
    r = cliente.get(base, headers=h)
    assert r.status_code == 404, f"esperaba 404, fue {r.status_code}: {r.text[:200]}"
    assert "perfiles" in r.json()["detail"].lower(), r.json()
    print("PASS: sin perfiles responde 404 y dice que hay que crear uno")

    # ── 2. Con perfiles y sin perfil_id: usa el primero activo ───────────────
    # Se crean en orden inverso al alfabetico a proposito: el default tiene que
    # salir del ORDEN, no de cual se inserto primero.
    db.add(PerfilRequisitos(mandante_id=codelco.id, nombre="Transporte", activo=True))
    db.add(PerfilRequisitos(mandante_id=codelco.id, nombre="Obras civiles", activo=True))
    db.commit()

    r = cliente.get(base, headers=h)
    assert r.status_code == 200, f"esperaba 200, fue {r.status_code}: {r.text[:200]}"
    assert r.json()["perfil"]["nombre"] == "Obras civiles", \
        f"debio tomar el primero por nombre, tomo {r.json()['perfil']['nombre']}"
    print("PASS: sin perfil_id toma el primer perfil activo, por nombre")

    # ── 3. Con perfil_id explicito manda el parametro ────────────────────────
    transporte = db.query(PerfilRequisitos).filter_by(nombre="Transporte").first()
    r = cliente.get(f"{base}?perfil_id={transporte.id}", headers=h)
    assert r.status_code == 200 and r.json()["perfil"]["nombre"] == "Transporte"
    print("PASS: con perfil_id devuelve ese perfil")

    # ── 4. El perfil de otro mandante no se puede mirar ──────────────────────
    otro = Mandante(razon_social="Pelambres", rut="70.000.000-7", slug="lp", plan="Pro")
    db.add(otro); db.flush()
    ajeno = PerfilRequisitos(mandante_id=otro.id, nombre="Ajeno", activo=True)
    db.add(ajeno); db.commit()
    r = cliente.get(f"{base}?perfil_id={ajeno.id}", headers=h)
    assert r.status_code == 404, f"dejo leer el perfil de otro mandante: {r.status_code}"
    print("PASS: no se puede pedir el perfil de otra organizacion")

    app.dependency_overrides.clear()
    print("TODOS LOS TESTS DEL ENDPOINT DE REQUISITOS PASARON")


if __name__ == "__main__":
    run()


# ── Puente para pytest ────────────────────────────────────────────────────────
def test_requisitos_endpoint():
    run()
