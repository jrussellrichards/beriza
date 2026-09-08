"""
El prevencionista VE los perfiles del mandante pero no los edita.

Observacion #4 del feedback del 2 de septiembre: al intentar modificar un perfil,
"me arrojo el mensaje: se requiere uno de estos roles berisa_admin,
mandante_admin". El arreglo de UX es mostrarle la pantalla en modo lectura; para
que eso sea posible, los GET tienen que dejarlo ver. Este test fija el contrato
de las dos mitades: ver SI, editar NO.

Lo que se verifica:

  1. el prevencionista del mandante lee /perfiles y /requisitos (200),
  2. y NO puede escribir: configurar un requisito, renombrar ni borrar un perfil
     le responden 403,
  3. el prevencionista de OTRO mandante no ve nada (403, aislamiento por tenant),
  4. el mandante_admin si puede ver y escribir.

Correr:  python tests/test_perfiles_solo_lectura.py
"""
import os
import sys
import tempfile

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("JWT_SECRET", "test")
os.environ["FILE_STORAGE"] = "local"
os.environ["LOCAL_STORAGE_PATH"] = tempfile.mkdtemp(prefix="acredita_perfiles_ro_")

from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401
from app.core.security import hash_password
from app.infrastructure.database import get_db
from app.models.base import Base
from app.models.mandante import Mandante
from app.models.pilar import Pilar, RequisitoDocumental, Subpilar
from app.models.usuario import Usuario
from app.domain import servicio_service

from tests._db import engine_sqlite
from main import app


def _headers(cliente, email):
    token = cliente.post("/api/v1/usuarios/login", json={
        "email": email, "password": "secreta-larga"}).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


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
        Usuario(email="prev@cod.cl", password_hash=hash_password("secreta-larga"),
                rol="prevencionista", nombre="Prevencion", activo=True, mandante_id=codelco.id),
        Usuario(email="prev@lp.cl", password_hash=hash_password("secreta-larga"),
                rol="prevencionista", nombre="Ajeno", activo=True, mandante_id=otro.id),
    ])
    pilar = Pilar(codigo="LEGAL", nombre="Legal", orden=1); db.add(pilar); db.flush()
    sub = Subpilar(pilar_id=pilar.id, codigo="EMP", nombre="Empresa", orden=1); db.add(sub); db.flush()
    req = RequisitoDocumental(subpilar_id=sub.id, codigo="F30", nombre="Certificado F30",
                             entidad_tipo="EMPRESA", alcance="ENTIDAD")
    db.add(req); db.commit()
    perfil = servicio_service.crear_perfil(db, codelco.id, "Obra civil")

    base = f"/api/v1/mandantes/{codelco.id}"

    # ── 1. El prevencionista LEE ─────────────────────────────────────────────
    hp = _headers(cliente, "prev@cod.cl")
    assert cliente.get(f"{base}/perfiles", headers=hp).status_code == 200
    r = cliente.get(f"{base}/requisitos?perfil_id={perfil.id}", headers=hp)
    assert r.status_code == 200, r.text
    print("PASS: el prevencionista puede ver perfiles y requisitos del mandante")

    # ── 2. El prevencionista NO escribe ──────────────────────────────────────
    escrituras = [
        ("post", f"{base}/perfiles/{perfil.id}/requisitos",
         {"requisito_documental_id": str(req.id), "es_obligatorio": True, "vigencia_max_dias": 90}),
        ("patch", f"{base}/perfiles/{perfil.id}", {"nombre": "Renombrado a la fuerza"}),
        ("put", f"{base}/perfiles/{perfil.id}/requisitos/{req.id}/cargos", {"cargo_ids": []}),
        ("delete", f"{base}/perfiles/{perfil.id}", None),
    ]
    for metodo, url, cuerpo in escrituras:
        fn = getattr(cliente, metodo)
        r = fn(url, headers=hp) if cuerpo is None else fn(url, headers=hp, json=cuerpo)
        assert r.status_code == 403, f"{metodo.upper()} {url} devolvio {r.status_code}, no 403"
    print("PASS: el prevencionista no puede configurar, renombrar, borrar ni tocar cargos")

    # ── 3. El prevencionista de otro mandante no ve nada ─────────────────────
    ha = _headers(cliente, "prev@lp.cl")
    assert cliente.get(f"{base}/perfiles", headers=ha).status_code == 403
    assert cliente.get(f"{base}/requisitos?perfil_id={perfil.id}", headers=ha).status_code == 403
    print("PASS: el prevencionista de otro mandante no ve los perfiles ajenos")

    # ── 4. El mandante_admin ve y escribe ────────────────────────────────────
    hj = _headers(cliente, "jefa@cod.cl")
    assert cliente.get(f"{base}/perfiles", headers=hj).status_code == 200
    r = cliente.post(f"{base}/perfiles/{perfil.id}/requisitos", headers=hj, json={
        "requisito_documental_id": str(req.id), "es_obligatorio": True, "vigencia_max_dias": 90})
    assert r.status_code == 201, r.text
    print("PASS: el mandante_admin ve y edita como siempre")

    db.close()
    app.dependency_overrides.clear()
    print("TODOS LOS TESTS DE PERFILES EN MODO LECTURA PASARON")


if __name__ == "__main__":
    run()


# ── Puente para pytest ────────────────────────────────────────────────────────
def test_perfiles_solo_lectura():
    run()
